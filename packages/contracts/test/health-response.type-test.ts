import type { HealthResponse } from '@flowforge/contracts';

// Case 1 — Valid response: conforms to contract
const _validResponse: HealthResponse = {
  status: 'ok',
  service: 'flowforge-api',
};
void _validResponse;

// Case 2 — Invalid status: must reject status other than 'ok'
const _invalidStatus: HealthResponse = {
  // @ts-expect-error Type '"error"' is not assignable to type '"ok"'
  status: 'error',
  service: 'flowforge-api',
};
void _invalidStatus;

// Case 3 — Invalid service: must reject service other than 'flowforge-api'
const _invalidService: HealthResponse = {
  status: 'ok',
  // @ts-expect-error Type '"other-service"' is not assignable to type '"flowforge-api"'
  service: 'other-service',
};
void _invalidService;

// Case 4 — Missing required property: must reject missing service
// @ts-expect-error Property 'service' is missing in type '{ readonly status: "ok"; }'
const _missingService: HealthResponse = {
  status: 'ok',
};
void _missingService;

// Case 5 — Readonly property: must reject mutation of readonly property
const _mutableResponse: HealthResponse = {
  status: 'ok',
  service: 'flowforge-api',
};
// @ts-expect-error Cannot assign to 'status' because it is a read-only property
_mutableResponse.status = 'ok';
