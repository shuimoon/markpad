"""Repackages the aapt2 resource apk with classes.dex, keeping resources.arsc
stored (required for targetSdk >= 30) so the package installs on Android 11+.

Usage: python tools/pack.py base.apk classes.dex out.apk
"""
import sys
import zipfile

base, dex, out = sys.argv[1], sys.argv[2], sys.argv[3]

with zipfile.ZipFile(base) as src, zipfile.ZipFile(out, "w") as dst:
    for item in src.infolist():
        data = src.read(item.filename)
        if item.filename in ("resources.arsc",):
            info = zipfile.ZipInfo(item.filename, date_time=item.date_time)
            info.compress_type = zipfile.ZIP_STORED
            info.external_attr = item.external_attr
            dst.writestr(info, data)
        else:
            dst.writestr(item.filename, data, compress_type=zipfile.ZIP_DEFLATED)
    dst.write(dex, "classes.dex", compress_type=zipfile.ZIP_DEFLATED)

print("packed", out)
