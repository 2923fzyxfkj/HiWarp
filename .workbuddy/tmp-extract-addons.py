import glob, os, json, re, sys

sys.stdout.reconfigure(encoding='utf-8')

D = os.path.expandvars(r"%APPDATA%\hiwarp-desktop\Local Storage\leveldb")
pat = '{"_":5'.encode('utf-16-le')
dec = json.JSONDecoder()

found = []
for f in sorted(glob.glob(os.path.join(D, '*'))):
    if os.path.isdir(f):
        continue
    try:
        b = open(f, 'rb').read()
    except PermissionError:
        print(f"[locked] {os.path.basename(f)}")
        continue
    for m in re.finditer(re.escape(pat), b):
        s = b[m.start():m.start() + 400000].decode('utf-16-le', 'ignore')
        try:
            obj, end = dec.raw_decode(s)
        except Exception as e:
            print(f"[skip] {os.path.basename(f)} @ {m.start()} {e}")
            continue
        n = len(obj)
        found.append((n, os.path.basename(f), m.start(), obj))

found.sort(reverse=True)
print("候选条目:", len(found))
for n, f, off, obj in found:
    print(f"  {f}@{off}  keys={n}")

if found:
    n, f, off, obj = found[0]
    print("\n=== 采用最大条目 ===", f, "keys =", n)
    enabled = sorted(k for k, v in obj.items()
                     if isinstance(v, dict) and v.get('enabled') is True)
    disabled = sorted(k for k, v in obj.items()
                      if isinstance(v, dict) and v.get('enabled') is False)
    other = sorted(k for k, v in obj.items()
                   if k != '_' and not (isinstance(v, dict) and 'enabled' in v))
    print("\n--- enabled (%d) ---" % len(enabled))
    for k in enabled:
        extra = {kk: vv for kk, vv in obj[k].items() if kk != 'enabled'}
        print(" ", k, extra if extra else "")
    print("\n--- disabled (%d) ---" % len(disabled))
    print(" ", disabled)
    print("\n--- 无 enabled 字段 (%d) ---" % len(other))
    print(" ", other)
    with open(os.path.join(os.path.dirname(__file__), 'addons-enabled.json'), 'w', encoding='utf-8') as fp:
        json.dump(obj, fp, ensure_ascii=False, indent=2)
    print("\n已写出完整 JSON")
