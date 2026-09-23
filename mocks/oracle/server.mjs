import http from "node:http";

const port = Number(process.env.PORT ?? 4002);

const server = http.createServer((req, res) => {
  res.setHeader("Content-Type", "application/json");
  if (req.url?.startsWith("/price")) {
    const url = new URL(req.url, `http://localhost:${port}`);
    const symbol = url.searchParams.get("symbol") ?? "COCOA";
    res.end(
      JSON.stringify({
        symbol,
        price: "8240.50",
        currency: "USD",
        grade: "A",
        attestedAt: new Date().toISOString(),
        mock: true,
      }),
    );
    return;
  }
  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
});

server.listen(port, () => {
  console.log(`Mock price oracle on :${port}`);
});
