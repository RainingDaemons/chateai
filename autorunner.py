import sys
import subprocess
from pathlib import Path
import shutil

def get_script_dir():
    """
    Devuelve la carpeta donde está el script 
    - Si está congelado, usa la ruta del ejecutable
    - En caso contrario, usa __file__
    """
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    else:
        return Path(__file__).resolve().parent

def ensure_dir(p):
    p.mkdir(parents=True, exist_ok=True)

def docker_available():
    return shutil.which("docker") is not None

def build_docker_command(base_dir, image, host_models_rel, host_llm_rel, container_models, container_llm, host_port, container_port, use_gpus):
    """
    Construye el comando docker run
    """
    host_models = (base_dir / host_models_rel).resolve()
    host_llm = (base_dir / host_llm_rel).resolve()

    ensure_dir(host_models)
    ensure_dir(host_llm)

    cmd = [
        "docker", "run",
        "--rm", "-it",
        "-p", f"{host_port}:{container_port}",
        "-v", f"{str(host_models)}:{container_models}",
        "-v", f"{str(host_llm)}:{container_llm}",
    ]

    # Soporte para GPUs
    if use_gpus:
        cmd.extend(["--gpus", "all"])

    cmd.append(image)

    return cmd

def main():
    base_dir = get_script_dir()
    print(f"[!] Carpeta base detectada: {base_dir}")

    if not docker_available():
        print("Error: No se encontró 'docker' en el PATH. Asegúrate de que Docker esté instalado y accesible desde la línea de comandos.")
        sys.exit(1)

    # Ejecutando docker
    image_name = "vllm"
    cmd = build_docker_command(
        base_dir=base_dir,
        image=image_name,
        host_models_rel="models",
        host_llm_rel="llm",
        container_models="/models",
        container_llm="/app",
        host_port=8000,
        container_port=8000,
        use_gpus=True
    )

    print("[!] Ejecutando:")
    print(" ", " ".join(f'"{c}"' if " " in c and not c.startswith("-") else c for c in cmd))

    try:
        # Heredamos stdin/stdout/stderr para interacción (-it)
        result = subprocess.run(cmd)
        sys.exit(result.returncode)
    except FileNotFoundError:
        print("Error: No se encontró el ejecutable de Docker. Asegúrate de que Docker esté instalado y en el PATH.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"Error: Fallo al ejecutar docker - {e}")
        sys.exit(e.returncode)

if __name__ == "__main__":
    main()
