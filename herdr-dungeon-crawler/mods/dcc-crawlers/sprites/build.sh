#!/bin/sh
# Turns src/<name>.txt into <name>.svg (24x24).
#   "=X #hex"  palette entry        "=mirror"  rows are the LEFT 12 columns; the right half is mirrored
#   "|" + 24 chars  a full row, not mirrored (for asymmetric details)
#   rows: one char per pixel, "." is transparent. Non-mirrored rows may stop early (padded with ".").
cd "$(dirname "$0")"
for f in src/*.txt; do
  n=$(basename "$f" .txt)
  awk -v name="$n" '
    function rev(s,   i, r) { r = ""; for (i = length(s); i >= 1; i--) r = r substr(s, i, 1); return r }
    /^=mirror/ { mirror = 1; next }
    /^=/ { pal[substr($1,2,1)] = $2; next }
    length($0) > 0 {
      row = $0
      if (substr(row, 1, 1) == "|") { row = substr(row, 2); if (length(row) > 24) printf "%s: row %d too long (%d)\n", name, h + 1, length(row) > "/dev/stderr" }
      else
      if (mirror) { if (length(row) != 12) printf "%s: row %d has %d cols (need 12): %s\n", name, h + 1, length(row), row > "/dev/stderr"; row = row rev(row) }
      else if (length(row) > 24) printf "%s: row %d too long (%d): %s\n", name, h + 1, length(row), row > "/dev/stderr"
      while (length(row) < 24) row = row "."
      rows[++h] = row
    }
    END {
      if (h != 24) printf "%s: has %d rows (need 24)\n", name, h > "/dev/stderr"
      printf "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" shape-rendering=\"crispEdges\">\n"
      for (y = 1; y <= h; y++) {
        x = 1
        while (x <= 24) {
          c = substr(rows[y], x, 1)
          if (c == "." || !(c in pal)) { x++; continue }
          s = x
          while (x <= 24 && substr(rows[y], x, 1) == c) x++
          printf "<rect x=\"%d\" y=\"%d\" width=\"%d\" height=\"1\" fill=\"%s\"/>\n", s - 1, y - 1, x - s, pal[c]
        }
      }
      print "</svg>"
    }' "$f" > "$n.svg"
done
