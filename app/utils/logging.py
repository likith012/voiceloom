import logging
import sys
from logging.handlers import RotatingFileHandler
from typing import Optional


def configure_logging(debug: bool, logfile: Optional[str] = None) -> None:
    """
    Configure loggers with a clean, consistent format.
    - debug=True  -> level=DEBUG, verbose
    - debug=False -> level=INFO
    - If logfile is provided write to a rotating file.
    """
    level = logging.DEBUG if debug else logging.INFO
    fmt = (
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s "
        "(%(filename)s:%(lineno)d)"
    )
    datefmt = "%Y-%m-%d %H:%M:%S"

    root = logging.getLogger()
    root.setLevel(level)

    # Clear existing handlers to avoid duplicate logs on app reload
    for h in list(root.handlers):
        root.removeHandler(h)

    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setLevel(level)
    stream_handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))
    root.addHandler(stream_handler)

    if logfile:
        file_handler = RotatingFileHandler(logfile, maxBytes=10 * 1024 * 1024, backupCount=3)
        file_handler.setLevel(level)
        file_handler.setFormatter(logging.Formatter(fmt=fmt, datefmt=datefmt))
        root.addHandler(file_handler)

    # Forces uvicorn loggers to use the same log level as root.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.setLevel(level)
        for h in list(lg.handlers):
            lg.removeHandler(h)
        lg.addHandler(stream_handler)
        if logfile:
            lg.addHandler(file_handler)


def get_logger(name: str) -> logging.Logger:
    """Get a logger with the specified name."""
    return logging.getLogger(name)
