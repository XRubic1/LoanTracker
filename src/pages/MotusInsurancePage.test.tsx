import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MotusInsurancePage } from './MotusInsurancePage';

describe('MotusInsurancePage', () => {
  it('renders a single lookup and the spreadsheet list', () => {
    const html = renderToStaticMarkup(
      <MotusInsurancePage
        clientInsurance={[
          {
            id: 1,
            client: 'Kanone LLC',
            mc: 'MC1359017',
            dot: '3788627',
            status: 'OK',
            expiration_date: null,
            last_cancellation_date: null,
          },
        ]}
        onUpdateCancellation={async () => {
          throw new Error('unused');
        }}
      />
    );
    expect(html).toContain('MOTUS insurance');
    expect(html).toContain('Look up');
    expect(html).toContain('Check clients');
    expect(html).toContain('Kanone LLC');
    expect(html).toContain('3788627');
  });
});
