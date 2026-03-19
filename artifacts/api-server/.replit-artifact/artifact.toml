kind = "api"
previewPath = "/api" # TODO - should be excluded from preview in the first place
title = "API Server"
version = "1.0.0"
id = "3B4_FFSkEVBkAeYMFRJ2e"

[[services]]
localPort = 8080
name = "API Server"
paths = ["/api"]

[services.development]
run = "pnpm --filter @workspace/api-server run dev"

[services.production]
build = "pnpm --filter @workspace/api-server run build"

[services.production.run]
args = ["node", "artifacts/api-server/dist/index.cjs"]

[services.production.run.env]
PORT = "8080"

[services.production.health.startup]
path = "/api/healthz"
