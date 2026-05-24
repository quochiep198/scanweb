from fastapi import FastAPI

app = FastAPI(title="OsteoAI API")

@app.get('/health')
def health():
    return {'status':'ok'}
