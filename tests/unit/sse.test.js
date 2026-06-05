const sse = require('../../src/sse');

// Faux objet Response capturant les écritures SSE.
const fakeRes = () => { const writes = []; return { writes, write: (p) => writes.push(p) }; };

describe('SSE — flux client', () => {
  it('émet uniquement au client enregistré', () => {
    const res = fakeRes();
    sse.addCustomerClient('cust-1', res);
    sse.emitToCustomer('cust-1', 'order_status_changed', { status: 'ready' });
    expect(res.writes).toHaveLength(1);
    expect(res.writes[0]).toContain('event: order_status_changed');
    expect(res.writes[0]).toContain('ready');
    sse.removeCustomerClient('cust-1', res);
  });

  it('n\'émet pas vers un autre client', () => {
    const a = fakeRes();
    sse.addCustomerClient('cust-A', a);
    sse.emitToCustomer('cust-B', 'order_status_changed', { status: 'preparing' });
    expect(a.writes).toHaveLength(0);
    sse.removeCustomerClient('cust-A', a);
  });

  it('removeCustomerClient stoppe les émissions', () => {
    const res = fakeRes();
    sse.addCustomerClient('cust-2', res);
    sse.removeCustomerClient('cust-2', res);
    sse.emitToCustomer('cust-2', 'order_status_changed', { status: 'ready' });
    expect(res.writes).toHaveLength(0);
  });

  it('emitToCustomer sans id ne plante pas', () => {
    expect(() => sse.emitToCustomer(null, 'x', {})).not.toThrow();
    expect(() => sse.emitToCustomer(undefined, 'x', {})).not.toThrow();
  });
});
