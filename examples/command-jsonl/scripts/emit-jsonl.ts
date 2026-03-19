const historyCount = Number.parseInt(process.argv[2] ?? "5", 10)

function emit(index: number) {
  console.log(
    JSON.stringify({
      level: index % 4 === 0 ? index % 6 === 0 ? "error" : "warn" : "info",
      message: `Command event ${index}`,
      payload: {
        attempt: index,
        host: "local",
      },
      service: "command-jsonl",
      ts: new Date(Date.now() + index * 1000).toISOString(),
    })
  )
}

for (let index = 0; index < historyCount; index += 1) {
  emit(index)
}

let nextIndex = historyCount

const interval = setInterval(() => {
  emit(nextIndex)
  nextIndex += 1
}, 250)

process.on("SIGTERM", () => {
  clearInterval(interval)
  process.exit(0)
})
