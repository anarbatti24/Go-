/**
 * Vite plugin — rooms API during `npm run dev`
 * Production uses Vercel `/api/rooms` + Upstash Redis.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleRoomsRequest } from './lib/rooms.ts'

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Invalid JSON'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export function roomsApiPlugin(): Plugin {
  return {
    name: 'go-rooms-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith('/api/rooms')) {
          next()
          return
        }

        try {
          const path = url.split('?')[0] ?? url
          const method = (req.method ?? 'GET').toUpperCase()
          const body =
            method === 'GET' || method === 'HEAD' ? {} : await readBody(req)
          const result = await handleRoomsRequest(method, path, body)
          sendJson(res, result.status, result.body)
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : 'Server error',
          })
        }
      })
    },
  }
}
