import sys
import subprocess
from pathlib import Path
import shutil

REPO_URL = "https://huggingface.co/intfloat/multilingual-e5-base"
TARGET_REL = Path("models") / "multilingual-e5-base"

def get_script_dir():
    """
    Devuelve la carpeta base donde está el script:
    - Si está congelado, usa la ruta del ejecutable.
    - En caso contrario, usa __file__.
    """
    if getattr(sys, 'frozen', False):
        return Path(sys.executable).resolve().parent
    else:
        return Path(__file__).resolve().parent

def ensure_dir(p: Path):
    p.mkdir(parents=True, exist_ok=True)

def which(cmd: str) -> bool:
    return shutil.which(cmd) is not None

def run(cmd, cwd=None, check=True):
    print("$", " ".join(cmd))
    return subprocess.run(cmd, cwd=str(cwd) if cwd else None, check=check)

def ensure_git_available():
    if not which("git"):
        print("Error: git no está instalado o accesible desde el sistema, intentalo nuevamente.")
        sys.exit(1)

def clone_repo(base_dir: Path, repo_url: str, target_rel: Path):
    target_abs = (base_dir / target_rel).resolve()
    ensure_dir(target_abs.parent)

    # Si repo existe: actualizar contenido
    if target_abs.exists() and (target_abs / ".git").exists():
        print(f"[!] Ya existe un repo en {target_abs}, ejecutando git pull...\n")
        run(["git", "pull"], cwd=target_abs)
        return

    # Si repo existe pero no es .git, clonar ahi mismo
    if target_abs.exists() and not (target_abs / ".git").exists():
        if not any(target_abs.iterdir()):
            print(f"[!] Repo no es .git, descargando en directorio {target_abs} ...\n")
        else:
            print(f"Error: El directorio {target_abs} ya existe y no está vacío, limpia este directorio o prueba otro.")
            sys.exit(2)

    # Si repo no existe descargar normalmente
    print(f"[!] Clonando {repo_url} en {target_abs} ...\n")
    run(["git", "clone", repo_url, str(target_abs)])

def main():
    base_dir = get_script_dir()
    print(f"[!] Carpeta base detectada: {base_dir}")

    ensure_git_available()
    clone_repo(base_dir, REPO_URL, TARGET_REL)

    final_path = (base_dir / TARGET_REL).resolve()
    print("\n[!] Repositorio descargado exitosamente en:", final_path)

if __name__ == "__main__":
    main()
