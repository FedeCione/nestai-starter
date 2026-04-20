import {
  OpenApiGeneratorV31,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';
import type { ZodType } from 'zod';

export function toOpenApiSchema(
  schema: ZodType,
  name: string,
): Record<string, unknown> {
  const registry = new OpenAPIRegistry();
  registry.register(name, schema);
  const generator = new OpenApiGeneratorV31(registry.definitions);
  const doc = generator.generateComponents();
  return doc.components?.schemas?.[name] as Record<string, unknown>;
}
