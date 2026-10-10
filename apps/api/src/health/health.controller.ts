import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  /** Feeds the load balancer / uptime check — see the Observability section of the plan. */
  @Get('healthz')
  check() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}
