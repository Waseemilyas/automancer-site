// /openapi.json — OpenAPI 3.1 specification of the public JSON API.
// Rendered from src/data/openapi.ts, which derives from the same registry
// (src/data/api.ts) and business facts (src/data/business.ts) as the
// endpoints themselves, so it cannot drift from what is served.
import { renderOpenApiSpec } from '../data/openapi';

export const GET = renderOpenApiSpec;
