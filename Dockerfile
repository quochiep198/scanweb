FROM python:3.10-slim

# Set up a new user named "user" with user ID 1000
RUN useradd -m -u 1000 user

# Switch to the "user" user
USER user

# Set home to the user's home directory
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

# Set the working directory to the user's home directory
WORKDIR $HOME/app

# Set system-wide environment variables
ENV MLFLOW_ALLOW_FILE_STORE=true

# Copy the current directory contents into the container at $HOME/app setting the owner to the user
COPY --chown=user ./backend/requirements.txt $HOME/app/requirements.txt

# Install CPU-only PyTorch & torchvision first to reduce download size (~3.3GB down to ~250MB) and build time on Hugging Face
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install dependencies (without --upgrade to prevent overwriting the CPU-only torch with the CUDA version)
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Copy the rest of the backend application
COPY --chown=user ./backend/app $HOME/app/app

# Expose port 7860 as required by Hugging Face Spaces
EXPOSE 7860

# Start the FastAPI server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
