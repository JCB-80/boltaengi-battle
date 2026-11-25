"""Build the Play App Bundle using JDK 17+, Android SDK 36, and bundletool.

Run python android-app/build_bundle.py --help for paths and signing options.
"""

import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile


ANDROID = Path(__file__).resolve().parent
GAME = ANDROID.parent
NS = "{http://schemas.android.com/apk/res/android}"


def java_binary(name):
    if os.environ.get("JAVA_HOME"):
        return Path(os.environ["JAVA_HOME"]) / "bin" / (name + (".exe" if os.name == "nt" else ""))
    executable = shutil.which(name)
    if not executable:
        raise SystemExit(f"Set JAVA_HOME to a JDK containing {name}.")
    return Path(executable)


def run(*args):
    subprocess.run([str(arg) for arg in args], check=True)


def game_files():
    yield GAME / "index.html"
    yield GAME / "privacy.html"
    for folder in ("src", "styles", "assets", "vendor"):
        yield from sorted(f for f in (GAME / folder).rglob("*") if f.is_file())


def build(options):
    manifest = ANDROID / "AndroidManifest.xml"
    root = ET.parse(manifest).getroot()
    sdk_spec = root.find("uses-sdk")
    minimum = sdk_spec.get(NS + "minSdkVersion")
    target = sdk_spec.get(NS + "targetSdkVersion")
    version = root.get(NS + "versionCode")
    sdk = Path(options.sdk)
    platform = sdk / "platforms" / f"android-{target}" / "android.jar"
    build_tools = sdk / "build-tools" / options.build_tools
    aapt = build_tools / ("aapt2.exe" if os.name == "nt" else "aapt2")
    d8 = build_tools / ("d8.bat" if os.name == "nt" else "d8")
    bundletool = Path(options.bundletool)
    for dep in (platform, aapt, d8, bundletool):
        if not dep.is_file():
            raise SystemExit(f"Missing build dependency: {dep}")

    signed = bool(options.keystore)
    suffix = "signed" if signed else "unsigned"
    output = options.output or ANDROID / "build" / f"boltaengi-battle-v{version}-{suffix}.aab"
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="battle-bundle-", dir=output.parent) as directory:
        work = Path(directory)
        compiled = work / "compiled-res.zip"
        resources = work / "resources.apk"
        run(aapt, "compile", "--dir", ANDROID / "res", "-o", compiled)
        run(aapt, "link", "--proto-format", "-I", platform, "--manifest", manifest,
            "-o", resources, compiled)

        classes = work / "classes"
        classes.mkdir()
        sources = sorted((ANDROID / "src").rglob("*.java"))
        run(java_binary("javac"), "--release", "8", "-encoding", "UTF-8",
            "-classpath", platform, "-d", classes, *sources)
        bytecode = work / "classes.jar"
        run(java_binary("jar"), "cf", bytecode, "-C", classes, ".")
        dex = work / "dex"
        dex.mkdir()
        run(d8, "--release", "--min-api", minimum, "--lib", platform, "--output", dex, bytecode)

        base = work / "base.zip"
        with ZipFile(base, "w", ZIP_DEFLATED) as module, ZipFile(resources) as packaged_resources:
            for name in packaged_resources.namelist():
                destination = "manifest/AndroidManifest.xml" if name == "AndroidManifest.xml" else name
                module.writestr(destination, packaged_resources.read(name))
            for file in sorted(dex.glob("*.dex")):
                module.write(file, "dex/" + file.name)
            for file in game_files():
                module.write(file, "assets/web/" + file.relative_to(GAME).as_posix())

        candidate = work / "candidate.aab"
        java = java_binary("java")
        run(java, "-jar", bundletool, "build-bundle", f"--modules={base}", f"--output={candidate}")
        run(java, "-jar", bundletool, "validate", f"--bundle={candidate}")
        if signed:
            # Read key passwords from the terminal; never store them in project files.
            run(java_binary("jarsigner"), "-keystore", options.keystore, candidate, options.alias)
            run(java_binary("jarsigner"), "-verify", candidate)
        os.replace(candidate, output)
    print(f"{suffix} bundle: {output}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", default=os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT"),
                        help="Android SDK directory (default: ANDROID_HOME)")
    parser.add_argument("--build-tools", default="36.0.0", help="installed Android build-tools revision")
    parser.add_argument("--bundletool", default=os.environ.get("BUNDLETOOL_JAR"),
                        help="path to bundletool-all.jar (tested with 1.18.3)")
    parser.add_argument("--keystore", type=Path, help="existing Google Play upload keystore; omit for an unsigned bundle")
    parser.add_argument("--alias", help="existing upload key alias for --keystore")
    parser.add_argument("--output", type=Path, help="destination .aab path")
    args = parser.parse_args()
    if not args.sdk or not args.bundletool:
        parser.error("Set --sdk and --bundletool, or their environment variables.")
    if bool(args.keystore) != bool(args.alias):
        parser.error("Provide both --keystore and --alias to sign with an existing upload key.")
    if args.keystore and not args.keystore.is_file():
        parser.error("The specified upload keystore does not exist.")
    build(args)
