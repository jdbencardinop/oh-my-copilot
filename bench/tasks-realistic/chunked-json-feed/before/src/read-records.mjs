export async function* readRecords(chunks) {
  let pending = "";
  for await (const chunk of chunks) {
    pending += Buffer.from(chunk).toString("utf8");
    const lines = pending.split("\n");
    pending = lines.pop();
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  }
}
