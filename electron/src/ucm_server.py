import uvicorn
from fastapi import FastAPI, WebSocket
from fastapi.websockets import WebSocketDisconnect
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UCM_Server")

app = FastAPI()


@app.websocket("/ws/orb_assistant")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    logger.info("🔌 Incoming ORB connection on /ws/orb_assistant")

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ORB_HANDSHAKE":
                logger.info(f"✅ Handshake Received from {message.get('orb_id')}")
                logger.info(f"   Role: {message.get('role')}")
                logger.info("   ORB ASSISTANT CONNECTED - STAND BY")

                # Send acknowledgment
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "HANDSHAKE_ACK",
                            "status": "connected",
                            "message": "UCM Core acknowledges ORB presence. Stand by.",
                        }
                    )
                )

            elif message.get("type") == "orb_click":
                logger.info("🖱️ ORB Clicked - Voluntary Interaction")

            else:
                logger.info(f"📨 Message: {data}")

    except WebSocketDisconnect:
        logger.info("❌ ORB Disconnected")


if __name__ == "__main__":
    logger.info("🚀 UCM 4 Core Mock Server Starting on :8000...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
