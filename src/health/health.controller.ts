import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Returns 200 OK when the API process is up. Use this as a liveness probe from load balancers, uptime monitors, or container orchestrators (Kubernetes `livenessProbe`, Docker `HEALTHCHECK`, Render/Railway health checks). `uptime` is the process uptime in seconds since the last restart — does **not** verify Postgres or Groq connectivity.',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      required: ['status', 'uptime'],
      properties: {
        status: { type: 'string', enum: ['ok'], example: 'ok' },
        uptime: {
          type: 'number',
          description: 'Process uptime in seconds',
          example: 42.17,
        },
      },
    },
  })
  check(): { status: 'ok'; uptime: number } {
    return { status: 'ok', uptime: process.uptime() };
  }
}
