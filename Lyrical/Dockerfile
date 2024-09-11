# Stage 1: Setup Conda environment
FROM python:3.7-slim AS conda-setup

# Set the working directory in the container
WORKDIR /app

# Install essential packages and download Miniconda
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential wget curl && \
    rm -rf /var/lib/apt/lists/* && \
    wget -q https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    bash /tmp/miniconda.sh -b -p /opt/miniconda && \
    rm /tmp/miniconda.sh

# Ensure conda is in the path
ENV PATH="/opt/miniconda/bin:$PATH"

# Stage 2: Install Dependencies and Application
FROM python:3.7-slim

# Set the working directory in the container
WORKDIR /app

# Install necessary tools and dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential libasound2-dev libjack-dev portaudio19-dev fluidsynth wget curl ffmpeg unzip && \
    rm -rf /var/lib/apt/lists/*


# Copy Conda environment from the first stage
COPY --from=conda-setup /opt/miniconda /opt/miniconda

# Ensure conda is in the path
ENV PATH="/opt/miniconda/bin:$PATH"

# Create and activate the Conda environment, then install Python dependencies
RUN conda create -n magenta python=3.7 -y && \
    /bin/bash -c "source activate magenta && \
    pip install --no-cache-dir absl-py==1.2.0 dm-sonnet==2.0.0 imageio==2.20.0 librosa==0.7.2 \
    matplotlib==3.5.2 mido==1.2.6 mir_eval==0.7 note-seq==0.0.3 numba==0.49.1 \
    numpy==1.21.6 Pillow==9.2.0 pretty_midi==0.2.9 pygtrie==2.5.0 python-rtmidi==1.1.2 \
    scikit-image==0.19.3 scipy==1.7.3 six==1.16.0 sk-video==1.1.10 sox==1.4.1 \
    tensorflow==2.9.1 tensorflow-datasets==4.6.0 tensorflow-probability==0.17.0 \
    tf_slim==1.1.0 wheel==0.37.1 magenta pygame note-seq Flask==2.2.5 flask-cors \
    PyJWT boto3 python-dotenv gunicorn" && \
    conda clean -afy


# Download the pre-trained model
RUN wget -q http://download.magenta.tensorflow.org/models/attention_rnn.mag -P /app/Lyrical



# Copy the application source code to the container
COPY . /app

# Expose the application port
EXPOSE 5000

# Run the application using Gunicorn
CMD ["/bin/bash", "-c", "source activate magenta && gunicorn --bind 0.0.0.0:5000 Lyrical.app:app"]
