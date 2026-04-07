from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl

try:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError
except ImportError:  # pragma: no cover
    YoutubeDL = None
    DownloadError = Exception

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
LOGGER = logging.getLogger("quickpull-processor")

app = FastAPI(title="QuickPull Processor", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR = Path(os.getenv("OUTPUT_DIR", "./downloads"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
BASE_DOWNLOAD_URL = os.getenv("BASE_DOWNLOAD_URL", "http://localhost:8000/files")
COOKIE_FILE = Path(os.getenv("YTDLP_COOKIE_FILE", "./cookies.txt"))
EXTRACTION_TIMEOUT_SECONDS = int(os.getenv("EXTRACTION_TIMEOUT_SECONDS", "9"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "180"))
GALLERY_TIMEOUT_SECONDS = int(os.getenv("GALLERY_TIMEOUT_SECONDS", "15"))
PINTEREST_TIMEOUT_SECONDS = int(os.getenv("PINTEREST_TIMEOUT_SECONDS", "6"))
TEMP_FILE_TTL_SECONDS = int(os.getenv("TEMP_FILE_TTL_SECONDS", "3600"))
MAX_DOWNLOAD_SIZE_BYTES = int(os.getenv("MAX_DOWNLOAD_SIZE_BYTES", str(500 * 1024 * 1024)))


class PreviewRequest(BaseModel):
    url: HttpUrl


class DownloadRequest(BaseModel):
    url: HttpUrl
    format_id: str
    enhance: bool = False


class FormatGroups(dict[str, list[dict[str, Any]]]):
    pass


class ExtractionFailure(RuntimeError):
    def __init__(self, message: str, attempts: list[str] | None = None):
        super().__init__(message)
        self.attempts = attempts or []


class YtdlpLogger:
    def debug(self, message: str) -> None:
        if message and message.startswith("[debug]"):
            LOGGER.debug(message)

    def warning(self, message: str) -> None:
        if "Signature extraction failed" in message or "SSAP" in message:
            LOGGER.warning("yt-dlp warning (continuing): %s", message)
            return
        LOGGER.warning(message)

    def error(self, message: str) -> None:
        LOGGER.error(message)


@app.on_event("startup")
def startup_log() -> None:
    LOGGER.info("Python service running on port 8000")
    cleanup_old_files()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/files/{filename}")
def get_file(filename: str, background_tasks: BackgroundTasks) -> FileResponse:
    safe_name = Path(filename).name
    if safe_name != filename or not re.fullmatch(r"[\w.\- ]+", safe_name):
        raise HTTPException(status_code=400, detail="Invalid filename")

    file_path = OUTPUT_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    background_tasks.add_task(delete_file, file_path)

    return FileResponse(
        file_path,
        media_type="application/octet-stream",
        filename=safe_name,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"'
        },
    )


def require_ytdlp() -> None:
    if YoutubeDL is None:
        raise HTTPException(status_code=500, detail="yt-dlp is not installed. Run pip install -r requirements.txt")


def primary_headers() -> dict[str, str]:
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }


def sanitize_filename(value: str, fallback: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', " ", value)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" .")
    return cleaned[:120] or fallback


def delete_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except Exception:
        LOGGER.warning("Temporary file cleanup failed for %s", path)


def cleanup_old_files() -> None:
    cutoff = time.time() - TEMP_FILE_TTL_SECONDS
    for file_path in OUTPUT_DIR.iterdir():
        if not file_path.is_file():
            continue
        try:
            if file_path.stat().st_mtime < cutoff:
                file_path.unlink(missing_ok=True)
        except Exception:
            LOGGER.warning("Old file cleanup failed for %s", file_path)


def ensure_safe_file(path: Path) -> Path:
    try:
        size = path.stat().st_size
    except FileNotFoundError as error:
        raise HTTPException(status_code=404, detail="Prepared file missing") from error

    if size <= 0:
        delete_file(path)
        raise HTTPException(status_code=500, detail="Prepared file was empty")

    if size > MAX_DOWNLOAD_SIZE_BYTES:
        delete_file(path)
        raise HTTPException(status_code=413, detail="Prepared file exceeded the maximum allowed size")

    return path


def run_with_timeout(fn: Callable[..., Any], *args: Any, timeout_seconds: int, timeout_message: str) -> Any:
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(fn, *args)
    try:
        return future.result(timeout=timeout_seconds)
    except FuturesTimeoutError as error:
        future.cancel()
        raise TimeoutError(timeout_message) from error
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def detect_platform(url: str) -> str:
    lowered = url.lower()
    if "youtube.com" in lowered or "youtu.be" in lowered:
        return "youtube"
    if "instagram.com" in lowered:
        return "instagram"
    if "twitter.com" in lowered or "x.com" in lowered:
        return "twitter"
    if "tiktok.com" in lowered:
        return "tiktok"
    if "facebook.com" in lowered:
        return "facebook"
    if "spotify.com" in lowered:
        return "spotify"
    if "reddit.com" in lowered:
        return "reddit"
    if "pinterest.com" in lowered or "pin.it" in lowered:
        return "pinterest"
    return "generic"


def clean_youtube_url(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.netloc.lower()

    if hostname == "youtu.be":
        video_id = parsed.path.strip("/")
        if video_id:
            cleaned = f"https://www.youtube.com/watch?v={video_id}"
            LOGGER.info("Final YouTube URL: %s", cleaned)
            return cleaned
        return url

    if "youtube.com" in hostname:
        query = parse_qs(parsed.query)
        video_id = query.get("v", [None])[0]
        if video_id:
            cleaned = f"https://www.youtube.com/watch?v={video_id}"
            LOGGER.info("Final YouTube URL: %s", cleaned)
            return cleaned

    return url


def youtube_video_id(url: str) -> str | None:
    parsed = urlparse(url)
    hostname = parsed.netloc.lower()

    if hostname == "youtu.be":
        video_id = parsed.path.strip("/")
        return video_id or None

    if "youtube.com" in hostname:
        query = parse_qs(parsed.query)
        return query.get("v", [None])[0]

    return None


def normalize_media_url(url: str) -> str:
    parsed = urlparse(url)
    hostname = parsed.netloc.lower()
    if "youtube.com" in hostname or hostname == "youtu.be":
        return clean_youtube_url(url)
    return url


def extractor_strategies(platform: str) -> list[tuple[str, dict[str, Any]]]:
    base: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "nocheckcertificate": True,
        "ignoreerrors": False,
        "retries": 0,
        "fragment_retries": 0,
        "socket_timeout": 8,
        "noplaylist": True,
        "extract_flat": False,
        "format": "best",
        "http_headers": primary_headers(),
        "logger": YtdlpLogger(),
        "extractor_args": {
            "youtube": {
                "player_client": ["tv_simply", "ios", "android"],
            }
        },
    }

    if COOKIE_FILE.exists():
        base["cookiefile"] = str(COOKIE_FILE)

    if platform == "youtube":
        youtube_primary = {
            **base,
            "extractor_args": {
                "youtube": {
                    "player_client": ["android"],
                }
            },
        }
        youtube_fallback = {
            **base,
            "extractor_args": {
                "youtube": {
                    "player_client": ["ios"],
                }
            },
        }
        return [("primary", youtube_primary), ("fallback", youtube_fallback)]

    header_fallback = {
        **base,
        "http_headers": {
            **primary_headers(),
            "Referer": "https://x.com/",
            "Origin": "https://x.com",
        },
    }

    relaxed_fallback = {
        **header_fallback,
        "extractor_retries": 1,
        "geo_bypass": True,
    }

    return [
        ("primary", base),
        ("headers", header_fallback),
        ("relaxed", relaxed_fallback),
    ]


def _extract_with_options(url: str, options: dict[str, Any]) -> dict[str, Any] | None:
    with YoutubeDL(options) as ydl:
        return ydl.extract_info(url, download=False)


def ytdlp_extract(url: str, platform: str) -> dict[str, Any]:
    require_ytdlp()
    attempts: list[str] = []

    normalized_url = normalize_media_url(url)

    for strategy_name, options in extractor_strategies(platform):
        try:
            info = run_with_timeout(
                _extract_with_options,
                normalized_url,
                options,
                timeout_seconds=EXTRACTION_TIMEOUT_SECONDS,
                timeout_message=f"yt-dlp {strategy_name} extraction timed out after {EXTRACTION_TIMEOUT_SECONDS}s",
            )
            if info:
                LOGGER.info("Preview extraction succeeded", extra={"url": url, "engine": "ytdlp", "strategy": strategy_name})
                return {"success": True, "engine": "ytdlp", "strategy": strategy_name, "data": info}
            attempts.append(f"ytdlp:{strategy_name}: no metadata returned")
        except TimeoutError as error:
            attempts.append(f"ytdlp:{strategy_name}: {error}")
        except DownloadError as error:
            attempts.append(f"ytdlp:{strategy_name}: {error}")
        except Exception as error:  # pragma: no cover
            attempts.append(f"ytdlp:{strategy_name}: {error}")

    raise ExtractionFailure("yt-dlp extraction failed", attempts)


def parse_gallery_entries(output: str) -> list[dict[str, Any]]:
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError:
        parsed = None

    if isinstance(parsed, list):
        if parsed and all(isinstance(item, dict) for item in parsed):
            return parsed

        normalized: list[dict[str, Any]] = []
        for item in parsed:
            if not isinstance(item, list) or len(item) < 3 or not isinstance(item[2], dict):
                continue
            entry = dict(item[2])
            if len(item) > 1 and isinstance(item[1], str):
                entry.setdefault("url", item[1])
            normalized.append(entry)
        if normalized:
            return normalized

    entries: list[dict[str, Any]] = []
    for line in output.splitlines():
        line = line.strip()
        if not line.startswith("{"):
            continue
        try:
            parsed_line = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed_line, dict):
            entries.append(parsed_line)
    return entries


def gallery_dl_extract(url: str, timeout_seconds: int | None = None) -> dict[str, Any]:
    attempts: list[str] = []
    commands = []

    gallery_binary = shutil.which("gallery-dl")
    if gallery_binary:
        commands.append([gallery_binary, "--dump-json", url])
    commands.append([sys.executable, "-m", "gallery_dl", "--dump-json", url])

    for index, command in enumerate(commands, start=1):
        try:
            result = subprocess.run(command, capture_output=True, text=True, check=False, timeout=timeout_seconds or GALLERY_TIMEOUT_SECONDS)
            if result.returncode != 0:
                attempts.append(f"gallery-dl:command-{index}: {result.stderr.strip() or result.stdout.strip() or 'non-zero exit'}")
                continue

            entries = parse_gallery_entries(result.stdout)
            if entries:
                LOGGER.info("Gallery fallback succeeded", extra={"url": url, "engine": "gallery-dl", "strategy": f"command-{index}"})
                return {
                    "success": True,
                    "engine": "gallery-dl",
                    "strategy": f"command-{index}",
                    "platform": detect_platform(url),
                    "data": build_gallery_info(url, entries),
                }

            attempts.append(f"gallery-dl:command-{index}: no JSON entries returned")
        except subprocess.TimeoutExpired:
            limit = timeout_seconds or GALLERY_TIMEOUT_SECONDS
            attempts.append(f"gallery-dl:command-{index}: timed out after {limit}s")
        except Exception as error:  # pragma: no cover
            attempts.append(f"gallery-dl:command-{index}: {error}")

    raise ExtractionFailure("gallery-dl extraction failed", attempts)


def pinterest_fallback_preview(url: str, title: str | None = None, thumbnail: str | None = None) -> dict[str, Any]:
    return {
        "success": True,
        "engine": "pinterest-fallback",
        "strategy": "limited-preview",
        "platform": "pinterest",
        "message": "Preview limited due to platform restrictions.",
        "fallback": True,
        "open_url": url,
        "data": {
            "id": str(uuid.uuid4()),
            "title": title or "Pinterest content",
            "duration": None,
            "thumbnail": thumbnail,
            "formats": {"video": [], "audio": [], "combined": []},
        },
    }


def metadata_ytdlp_extract(url: str, platform: str) -> dict[str, Any]:
    require_ytdlp()
    normalized_url = normalize_media_url(url)
    options = {
        **extractor_strategies(platform)[0][1],
        "extract_flat": True,
        "skip_download": True,
        "format": "best",
        "noplaylist": True,
        "retries": 0,
        "fragment_retries": 0,
        "socket_timeout": 6,
    }

    info = run_with_timeout(
        _extract_with_options,
        normalized_url,
        options,
        timeout_seconds=6,
        timeout_message="metadata extraction timed out after 6s",
    )
    if not info:
        raise ExtractionFailure("Metadata extraction failed", ["metadata: no metadata returned"])

    return {
        "success": True,
        "engine": "metadata",
        "strategy": "flat-primary",
        "platform": platform,
        "data": info,
    }


def spotify_metadata_extract(url: str) -> dict[str, Any]:
    message = "Spotify downloads are not directly supported. Try searching this track on YouTube."
    fallback_id = str(uuid.uuid4())
    parsed = urlparse(url)
    slug = parsed.path.rstrip("/").split("/")[-1] if parsed.path else fallback_id
    fallback_title = slug.replace("-", " ").replace("_", " ").strip() or "Spotify track"

    try:
        extracted = ytdlp_extract(url, "spotify")
        info = extracted["data"]
        artist = info.get("artist") or info.get("uploader") or info.get("creator")
        title = str(info.get("title") or fallback_title)
        if artist and artist.lower() not in title.lower():
            title = f"{artist} - {title}"
        return {
            "success": True,
            "engine": "spotify",
            "strategy": "metadata",
            "platform": "spotify",
            "message": message,
            "data": {
                "id": info.get("id") or fallback_id,
                "title": title,
                "duration": info.get("duration"),
                "thumbnail": info.get("thumbnail"),
                "formats": {"video": [], "audio": [], "combined": []},
            },
        }
    except Exception as error:
        LOGGER.warning("Spotify metadata extraction fell back to URL-only metadata for %s: %s", url, error)
        return {
            "success": True,
            "engine": "spotify",
            "strategy": "url-fallback",
            "platform": "spotify",
            "message": message,
            "data": {
                "id": fallback_id,
                "title": fallback_title.title(),
                "duration": None,
                "thumbnail": None,
                "formats": {"video": [], "audio": [], "combined": []},
            },
        }


def youtube_metadata_fallback(url: str) -> dict[str, Any] | None:
    video_id = youtube_video_id(url)
    if not video_id:
        return None

    return {
        "success": True,
        "engine": "youtube-fallback",
        "strategy": "video-id-thumbnail",
        "platform": "youtube",
        "message": "Preview is limited right now, but QuickPull still detected the YouTube video.",
        "fallback": True,
        "data": {
            "id": video_id,
            "title": "YouTube video",
            "duration": None,
            "thumbnail": f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
            "formats": {"video": [], "audio": [], "combined": []},
        },
    }


def extract_media(url: str) -> dict[str, Any]:
    platform = detect_platform(url)
    LOGGER.info("Incoming URL: %s", url)
    LOGGER.info("Detected platform: %s", platform)
    errors: list[str] = []

    if platform == "spotify":
        return spotify_metadata_extract(url)

    if platform == "pinterest":
        try:
            result = gallery_dl_extract(url, timeout_seconds=PINTEREST_TIMEOUT_SECONDS)
            result["platform"] = platform
            return result
        except ExtractionFailure as error:
            LOGGER.warning("Pinterest fallback preview activated for %s", url)
            errors.extend(error.attempts)
            return {
                **pinterest_fallback_preview(url),
                "attempts": errors,
            }

    try:
        result = ytdlp_extract(url, platform)
        result["platform"] = platform
        return result
    except ExtractionFailure as error:
        errors.extend(error.attempts)

    if is_gallery_friendly(url):
        try:
            return gallery_dl_extract(url)
        except ExtractionFailure as error:
            errors.extend(error.attempts)

    try:
        return gallery_dl_extract(url)
    except ExtractionFailure as error:
        errors.extend(error.attempts)

    LOGGER.error("Extraction failed for %s", url)
    return {
        "success": False,
        "error": "All extraction methods failed.",
        "message": "This link is harder to process. Try again, add cookies, or use a different link.",
        "attempts": errors,
    }


def is_gallery_friendly(url: str) -> bool:
    lowered = url.lower()
    return any(domain in lowered for domain in ["instagram.com", "x.com", "twitter.com", "reddit.com", "pinterest.com"])


def build_gallery_info(url: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
    first = next((entry for entry in entries if entry.get("url")), entries[0])
    title = (
        first.get("title")
        or first.get("grid_title")
        or (first.get("rich_metadata") or {}).get("title")
        or first.get("tweet_id")
        or first.get("post_id")
        or first.get("filename")
        or f"Gallery extraction for {urlparse(url).netloc}"
    )
    thumbnail = first.get("thumbnail") or first.get("url")
    formats: list[dict[str, Any]] = []

    for index, entry in enumerate(entries):
        asset_url = entry.get("url")
        if not asset_url:
            continue

        ext = str(entry.get("extension") or infer_extension(asset_url) or "bin").lower()
        width = entry.get("width")
        height = entry.get("height")
        resolution = f"{height}p" if height else (f"{width}x{height}" if width and height else None)
        is_audio = ext in {"mp3", "m4a", "aac", "wav", "ogg", "opus"}
        is_video = ext in {"mp4", "webm", "mov", "mkv", "m3u8"}
        is_image = ext in {"jpg", "jpeg", "png", "webp", "gif"}
        if not is_audio and not is_video and not is_image:
            continue

        format_type = "audio" if is_audio else "combined"
        formats.append(
            {
                "id": f"gallery:{format_type}:{index}",
                "type": format_type,
                "ext": ext,
                "resolution": resolution,
                "audioBitrate": None,
                "sizeEstimate": human_size(entry.get("filesize")),
                "formatNote": "Direct image asset" if is_image else (None if is_audio else "Direct media asset"),
                "hasVideo": is_video or is_image,
                "hasAudio": is_audio or is_video,
                "sourceUrl": asset_url,
            }
        )

    grouped: FormatGroups = {"video": [], "audio": [], "combined": []}
    for item in formats:
        grouped[item["type"]].append(item)

    if grouped["combined"]:
        grouped["combined"] = [build_best_quality_option("gallery-dl"), *grouped["combined"]]
    elif formats:
        grouped["combined"] = [build_best_quality_option("gallery-dl"), formats[0]]
    else:
        grouped["combined"] = [build_best_quality_option("gallery-dl")]

    return {
        "id": first.get("id") or str(uuid.uuid4()),
        "title": str(title),
        "duration": None,
        "thumbnail": thumbnail,
        "formats": grouped,
        "raw_entries": entries,
    }


def classify_formats(info: dict[str, Any], engine: str) -> FormatGroups:
    if engine in {"pinterest-fallback", "youtube-fallback"}:
        return info.get("formats") or {"video": [], "audio": [], "combined": []}
    if engine == "spotify":
        return info.get("formats") or {"video": [], "audio": [], "combined": []}
    if engine == "gallery-dl":
        return info.get("formats") or {"video": [], "audio": [], "combined": [build_best_quality_option(engine)]}

    grouped: FormatGroups = {"video": [], "audio": [], "combined": []}
    seen: set[tuple[str, str, str]] = set()

    for fmt in info.get("formats", []) or []:
        if not is_useful_media_format(fmt):
            continue

        format_id = str(fmt.get("format_id") or "").strip()
        ext = str(fmt.get("ext") or "bin").strip().lower()
        vcodec = str(fmt.get("vcodec") or "none")
        acodec = str(fmt.get("acodec") or "none")
        has_video = vcodec != "none"
        has_audio = acodec != "none"
        resolution = get_resolution(fmt)
        audio_bitrate = get_audio_bitrate(fmt)
        size_estimate = human_size(fmt.get("filesize") or fmt.get("filesize_approx"))

        unique_key = (resolution or audio_bitrate or "unknown", ext, size_estimate)
        if unique_key in seen:
            continue
        seen.add(unique_key)

        item = {
            "id": build_format_identifier(format_id, has_video, has_audio, engine),
            "type": format_group(has_video, has_audio),
            "ext": ext,
            "resolution": resolution,
            "audioBitrate": audio_bitrate,
            "sizeEstimate": size_estimate,
            "formatNote": clean_format_note(fmt),
            "hasVideo": has_video,
            "hasAudio": has_audio,
        }

        direct_url = fmt.get("url")
        if direct_url:
            item["sourceUrl"] = direct_url

        grouped[item["type"]].append(item)

    grouped["video"] = sort_group("video", grouped["video"])
    grouped["audio"] = sort_group("audio", grouped["audio"])
    grouped["combined"] = [build_best_quality_option(engine), *sort_group("combined", grouped["combined"])]
    return grouped


def is_useful_media_format(fmt: dict[str, Any]) -> bool:
    format_id = str(fmt.get("format_id") or "").strip()
    if not format_id:
        return False

    ext = str(fmt.get("ext") or "").strip().lower()
    if ext == "mhtml":
        return False

    note = " ".join(
        str(value).lower()
        for value in [fmt.get("format_note"), fmt.get("format"), fmt.get("protocol")]
        if value
    )
    if "storyboard" in note or "thumbnail" in note or "image" in note:
        return False

    vcodec = str(fmt.get("vcodec") or "none")
    acodec = str(fmt.get("acodec") or "none")
    has_video = vcodec != "none"
    has_audio = acodec != "none"
    if not has_video and not has_audio:
        return False

    resolution = get_resolution(fmt)
    audio_bitrate = get_audio_bitrate(fmt)
    if resolution is None and audio_bitrate is None:
        return False

    return True


def clean_format_note(fmt: dict[str, Any]) -> str | None:
    note = str(fmt.get("format_note") or "").strip()
    if not note:
        note = str(fmt.get("format") or "").strip()
    lowered = note.lower()
    if any(token in lowered for token in ["storyboard", "thumbnail", "image", "dash audio", "dash video"]):
        return None
    return note or None


def build_best_quality_option(engine: str) -> dict[str, Any]:
    return {
        "id": f"{engine}:combined:best",
        "type": "combined",
        "ext": "mp4",
        "resolution": "Best quality",
        "audioBitrate": None,
        "sizeEstimate": "Unknown",
        "formatNote": "Merged best video and audio when available",
        "hasVideo": True,
        "hasAudio": True,
    }


def build_format_identifier(format_id: str, has_video: bool, has_audio: bool, engine: str) -> str:
    if has_video and has_audio:
        return f"{engine}:combined:{format_id}"
    if has_video:
        return f"{engine}:video:{format_id}"
    return f"{engine}:audio:{format_id}"


def format_group(has_video: bool, has_audio: bool) -> str:
    if has_video and has_audio:
        return "combined"
    if has_video:
        return "video"
    return "audio"


def get_resolution(fmt: dict[str, Any]) -> str | None:
    if fmt.get("height"):
        return f"{fmt['height']}p"
    if fmt.get("resolution") and fmt.get("resolution") != "audio only":
        return str(fmt["resolution"])
    if fmt.get("width") and fmt.get("height"):
        return f"{fmt['width']}x{fmt['height']}"
    return None


def get_audio_bitrate(fmt: dict[str, Any]) -> str | None:
    abr = fmt.get("abr")
    if abr:
        return f"{int(round(float(abr)))} kbps"
    tbr = fmt.get("tbr")
    vcodec = str(fmt.get("vcodec") or "none")
    if tbr and vcodec == "none":
        return f"{int(round(float(tbr)))} kbps"
    return None


def sort_group(group: str, items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if group in {"video", "combined"}:
        return sorted(items, key=lambda item: (resolution_rank(item.get("resolution")), bitrate_rank(item.get("audioBitrate"))))
    return sorted(items, key=lambda item: bitrate_rank(item.get("audioBitrate")))


def resolution_rank(value: str | None) -> int:
    if not value:
        return 0
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits) if digits else 0


def bitrate_rank(value: str | None) -> int:
    if not value:
        return 0
    digits = "".join(ch for ch in value if ch.isdigit())
    return int(digits) if digits else 0


@app.post("/preview/metadata")
def preview_metadata(payload: PreviewRequest) -> dict[str, Any]:
    platform = detect_platform(str(payload.url))

    try:
        if platform == "spotify":
            extracted = spotify_metadata_extract(str(payload.url))
        elif platform == "pinterest":
            try:
                extracted = gallery_dl_extract(str(payload.url), timeout_seconds=4)
            except ExtractionFailure:
                extracted = pinterest_fallback_preview(str(payload.url))
        else:
            try:
                extracted = metadata_ytdlp_extract(str(payload.url), platform)
            except Exception:
                if platform == "youtube":
                    fallback = youtube_metadata_fallback(str(payload.url))
                    if fallback:
                        extracted = fallback
                    else:
                        raise
                else:
                    raise
    except Exception as error:
        LOGGER.exception("Metadata preview failed for %s", payload.url)
        return {
            "success": False,
            "platform": platform,
            "message": "Unable to load preview metadata right now.",
            "error": str(error),
        }

    info = extracted["data"]
    return {
        "success": True,
        "id": info.get("id") or str(uuid.uuid4()),
        "title": info.get("title") or "Detected media",
        "duration": seconds_to_hms(info.get("duration")),
        "thumbnail": info.get("thumbnail"),
        "platform": extracted.get("platform") or platform,
        "message": extracted.get("message"),
        "fallback": extracted.get("fallback", False),
        "openUrl": extracted.get("open_url") or str(payload.url),
        "formats": {"video": [], "audio": [], "combined": []},
    }


@app.post("/preview")
def preview(payload: PreviewRequest) -> dict[str, Any]:
    platform = detect_platform(str(payload.url))
    extracted = extract_media(str(payload.url))
    if not extracted.get("success"):
        return {
            "success": False,
            "platform": platform,
            "error": extracted.get("error") or "Preview extraction failed.",
            "message": extracted.get("message") or "Unable to fetch this link right now.",
            "attempts": extracted.get("attempts", []),
        }

    info = extracted["data"]
    engine = str(extracted.get("engine") or "ytdlp")
    try:
        formats = classify_formats(info, engine)
    except Exception as error:  # pragma: no cover
        LOGGER.exception("Format classification failed for %s", payload.url)
        return {
            "success": False,
            "title": info.get("title") or "Detected media",
            "thumbnail": info.get("thumbnail"),
            "duration": seconds_to_hms(info.get("duration")),
            "message": "Metadata was found, but full format parsing failed.",
            "error": str(error),
            "attempts": [f"engine:{engine}", f"strategy:{extracted.get('strategy', 'unknown')}"],
        }

    return {
        "success": True,
        "id": info.get("id") or str(uuid.uuid4()),
        "title": info.get("title") or "Detected media",
        "duration": seconds_to_hms(info.get("duration")),
        "thumbnail": info.get("thumbnail"),
        "platform": extracted.get("platform") or platform,
        "message": extracted.get("message"),
        "formats": formats,
        "engine": engine,
        "strategy": extracted.get("strategy", "primary"),
    }


def _download_with_options(url: str, options: dict[str, Any]) -> None:
    with YoutubeDL(options) as ydl:
        ydl.download([url])


@app.post("/download")
def download(payload: DownloadRequest) -> dict[str, Any]:
    platform = detect_platform(str(payload.url))
    LOGGER.info("Download request received", extra={"url": str(payload.url), "format_id": payload.format_id, "platform": platform})
    cleanup_old_files()
    if platform == "spotify":
        return {
            "success": False,
            "error": "Spotify downloads are not directly supported.",
            "message": "Spotify downloads are not directly supported. Try searching this track on YouTube.",
        }

    extracted = extract_media(str(payload.url))
    if not extracted.get("success"):
        return {
            "success": False,
            "error": extracted.get("error") or "Download extraction failed.",
            "message": extracted.get("message") or "Unable to prepare this media right now.",
        }

    info = extracted["data"]
    engine = str(extracted.get("engine") or "ytdlp")
    media_id = info.get("id") or str(uuid.uuid4())
    title_slug = sanitize_filename(str(info.get("title") or media_id), media_id)

    if engine == "gallery-dl":
        direct_url = resolve_gallery_source(info, payload.format_id)
        if not direct_url:
            return {
                "success": False,
                "error": "No gallery-dl asset URL was available for this format.",
                "message": "QuickPull found the post, but could not resolve a direct media asset.",
            }
        if direct_url.endswith(".m3u8") and shutil.which("ffmpeg"):
            output_file = OUTPUT_DIR / f"{title_slug}-{media_id}.mp4"
            if download_hls_stream(direct_url, output_file):
                prepared_file = ensure_safe_file(output_file)
                return {
                    "success": True,
                    "download_url": f"{BASE_DOWNLOAD_URL}/{prepared_file.name}",
                    "status": "completed",
                    "filename": prepared_file.name,
                }
        ext = infer_extension(direct_url) or "bin"
        output_file = OUTPUT_DIR / f"{title_slug}-{media_id}.{ext}"
        downloaded_file = download_remote_asset(direct_url, output_file)
        if downloaded_file:
            prepared_file = ensure_safe_file(downloaded_file)
            return {
                "success": True,
                "download_url": f"{BASE_DOWNLOAD_URL}/{prepared_file.name}",
                "status": "completed",
                "filename": prepared_file.name,
            }
        return {
            "success": False,
            "error": "QuickPull could not mirror the remote gallery asset.",
            "message": "The media was found, but the direct asset could not be packaged for download.",
        }

    output_template = str(OUTPUT_DIR / f"{title_slug}-{media_id}.%(ext)s")
    normalized_url = normalize_media_url(str(payload.url))
    ydl_opts: dict[str, Any] = {
        **extractor_strategies(platform)[0][1],
        "skip_download": False,
        "outtmpl": output_template,
        "merge_output_format": "mp4",
    }

    _, category, raw_format_id = split_format_id(payload.format_id)
    format_token = raw_format_id or payload.format_id

    if category == "combined" and format_token == "best":
        ydl_opts["format"] = "bestvideo*+bestaudio/best"
    else:
        ydl_opts["format"] = format_token or "best"

    try:
        require_ytdlp()
        run_with_timeout(
            _download_with_options,
            normalized_url,
            ydl_opts,
            timeout_seconds=DOWNLOAD_TIMEOUT_SECONDS,
            timeout_message=f"download timed out after {DOWNLOAD_TIMEOUT_SECONDS}s",
        )
    except Exception as error:  # pragma: no cover
        LOGGER.exception("Download failed for %s", payload.url)
        return {
            "success": False,
            "error": str(error),
            "message": "QuickPull could not generate a download for this link.",
        }

    selected_ext = resolve_extension(info, payload.format_id)
    final_name = f"{title_slug}-{media_id}.{selected_ext}"
    prepared_file = ensure_safe_file(OUTPUT_DIR / final_name)
    download_url = f"{BASE_DOWNLOAD_URL}/{prepared_file.name}"
    LOGGER.info("Download completed", extra={"url": str(payload.url), "download_url": download_url})
    return {
        "success": True,
        "download_url": download_url,
        "status": "completed",
        "filename": prepared_file.name,
    }


def split_format_id(format_id: str) -> tuple[str, str, str]:
    parts = format_id.split(":", 2)
    if len(parts) == 3:
        return parts[0], parts[1], parts[2]
    return "ytdlp", "combined", format_id


def resolve_gallery_source(info: dict[str, Any], format_id: str) -> str | None:
    _, _, raw_id = split_format_id(format_id)
    entries = info.get("raw_entries") or []
    try:
        index = int(raw_id)
    except ValueError:
        index = 0
    if 0 <= index < len(entries):
        return entries[index].get("url")
    return None


def download_hls_stream(stream_url: str, output_file: Path) -> bool:
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", stream_url, "-c", "copy", str(output_file)],
            check=True,
            capture_output=True,
            text=True,
            timeout=DOWNLOAD_TIMEOUT_SECONDS,
        )
        return True
    except Exception:
        return False


def download_remote_asset(source_url: str, output_file: Path) -> Path | None:
    try:
        request = Request(source_url, headers=primary_headers())
        with urlopen(request, timeout=20) as response, output_file.open("wb") as destination:
            shutil.copyfileobj(response, destination)
        return output_file
    except Exception:
        LOGGER.exception("Remote asset mirroring failed for %s", source_url)
        try:
            output_file.unlink(missing_ok=True)
        except Exception:
            pass
        return None


def resolve_extension(info: dict[str, Any], format_id: str) -> str:
    engine, category, raw_format_id = split_format_id(format_id)
    if engine in {"gallery", "gallery-dl"}:
        source = resolve_gallery_source(info, format_id)
        return infer_extension(source) or ("m4a" if category == "audio" else "mp4")
    if category == "combined" and raw_format_id == "best":
        return "mp4"
    for fmt in info.get("formats", []) or []:
        if str(fmt.get("format_id")) == raw_format_id:
            return str(fmt.get("ext") or ("m4a" if category == "audio" else "mp4"))
    return "m4a" if category == "audio" else "mp4"


def infer_extension(url: str | None) -> str | None:
    if not url:
        return None
    path = urlparse(url).path
    suffix = Path(path).suffix.lower().lstrip(".")
    return suffix or None


def human_size(size: int | None) -> str:
    if not size:
        return "Unknown"
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    unit_index = 0
    while value >= 1024 and unit_index < len(units) - 1:
        value /= 1024
        unit_index += 1
    return f"{value:.0f} {units[unit_index]}"


def seconds_to_hms(seconds: int | None) -> str | None:
    if not seconds:
        return None
    minutes, sec = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}:{minutes:02d}:{sec:02d}"
    return f"{minutes}:{sec:02d}"




















