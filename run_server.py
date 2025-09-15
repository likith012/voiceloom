import uvicorn

from app.core.config import get_settings


def main() -> None:
    s = get_settings()
    uvicorn.run(
        "app.main:app",
        host=s.host,
        port=s.port,
        reload=s.debug,
        ssl_keyfile=s.ssl_keyfile,
        ssl_certfile=s.ssl_certfile,
    )


if __name__ == "__main__":
    main()
