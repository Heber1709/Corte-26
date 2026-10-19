// Run after npm run build. Uses mocks; never changes a database.
const assert = require('node:assert/strict');
const { UsersService } = require('../dist/src/users/users.service');
const { AppointmentsService } = require('../dist/src/appointments/appointments.service');
const { ServicesController } = require('../dist/src/services/services.controller');
const { JwtStrategy } = require('../dist/src/auth/jwt.strategy');
const { AdminDto } = require('../dist/src/dto/manage.dto');
const { validate } = require('class-validator');
const { can } = require('../dist/src/common/permissions');

(async () => {
  const owner = { id: 1, role: 'ADMIN', isSuperAdmin: true, permissions: [] };
  const limited = { id: 2, role: 'ADMIN', isSuperAdmin: false, permissions: ['CLIENTS'] };
  let existing = { id: 3, role: 'ADMIN', isSuperAdmin: false };
  let values;
  const db = { user: {
    findUnique: async () => existing,
    findMany: async data => (values = data),
    update: async data => (values = data),
    create: async data => (values = data),
    updateMany: async data => { values = data; return { count: 0 }; },
  }, appointment: { findMany: data => (values = data) } };
  db.$transaction = fn => fn(db);
  const users = new UsersService(db);
  const data = { name: 'Example', email: 'EXAMPLE@example.test', permissions: ['CLIENTS'] };
  assert.ok(can(owner, 'BARBERS'));
  assert.ok(can(limited, 'CLIENTS'));
  assert.equal(can(limited, 'BARBERS'), false);
  assert.equal(can({ role: 'CLIENT', isSuperAdmin: true }, 'BARBERS'), false);
  assert.throws(() => users.administrators(limited), /superadministrador/);
  await assert.rejects(() => users.saveAdministrator(limited, data), /superadministrador/);
  await assert.rejects(() => users.revokeAdministrator(limited, 1), /superadministrador/);
  await users.saveAdministrator(owner, data);
  assert.equal(values.where.id, 3);
  assert.deepEqual(values.data.permissions, ['CLIENTS']);
  assert.equal(Object.hasOwn(values.data, 'isSuperAdmin'), false);
  existing = owner;
  await assert.rejects(() => users.saveAdministrator(owner, data), /superadministrador/);
  existing = { id: 3, role: 'BARBER' };
  await assert.rejects(() => users.saveAdministrator(owner, data), /barbero/);
  await assert.rejects(() => users.revokeAdministrator(owner, 1));
  assert.equal(values.where.isSuperAdmin, false);
  assert.equal(values.where.NOT.id, 1);
  await assert.rejects(() => users.save(limited, data, 'BARBER'));
  await users.save(limited, data, 'CLIENT');
  await assert.rejects(() => users.reactivate(limited, 3));
  const appointments = new AppointmentsService(db);
  appointments.list(limited);
  assert.deepEqual(values.where.AND[0], { clientId: 2 });
  await assert.rejects(() => appointments.create({ clientId: 3 }, limited));
  const services = new ServicesController({ create: data => data });
  assert.throws(() => services.create({}, limited));
  assert.deepEqual(services.create({}, owner), {});
  const invalid = Object.assign(new AdminDto(), data, { permissions: ['SUPER_ADMIN'] });
  assert.ok((await validate(invalid)).length > 0);
  // Stale JWT claims must not preserve privileges after database revocation.
  existing = { id: 2, role: 'CLIENT', isSuperAdmin: false, permissions: [] };
  const current = await new JwtStrategy(db).validate({ sub: 2, email: data.email, role: 'ADMIN' });
  assert.equal(can(current, 'CLIENTS'), false);
  console.log('OK: superadmin isolation, scoped permissions, protected owner, revocation and stale JWT checks');
})().catch(error => { console.error(error); process.exitCode = 1; });
