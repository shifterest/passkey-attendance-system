import logging

import uvicorn
from api.config import BACKEND_PORT

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
file_handler = logging.FileHandler("app.log")
file_handler.setLevel(logging.INFO)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)
logging.getLogger().addHandler(file_handler)

if __name__ == "__main__":
    logging.info("Starting...")
    uvicorn.run(
        "api.api:app",
        host="0.0.0.0",
        port=BACKEND_PORT,
        reload=True,
        reload_dirs=["api"],
        reload_excludes=["*.log"],
    )
