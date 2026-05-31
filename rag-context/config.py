import os
import json
from dotenv import load_dotenv

# Load standard .env file if it exists
load_dotenv()

class RAGConfig:
    def __init__(self):
        self.config_path = os.getenv("RAG_CONFIG_PATH")
        if not self.config_path:
            # Default to rag-config.json in the current working directory or same folder
            self.config_path = "rag-config.json"
            if not os.path.exists(self.config_path):
                # Try finding it in the folder where config.py lives
                base_dir = os.path.dirname(os.path.abspath(__file__))
                self.config_path = os.path.join(base_dir, "rag-config.json")
        
        self.data = {}
        self.load()

    def load(self):
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    self.data = json.load(f)
                print(f"Loaded config from {self.config_path}")
            except Exception as e:
                print(f"Error loading config from {self.config_path}: {e}")
        else:
            print(f"Warning: Config file not found at {self.config_path}. Using environment variables/defaults.")

    def get(self, key, default=None):
        keys = key.split(".")
        val = self.data
        for k in keys:
            if isinstance(val, dict) and k in val:
                val = val[k]
            else:
                return default
        return val

# Global config instance
cfg = RAGConfig()
