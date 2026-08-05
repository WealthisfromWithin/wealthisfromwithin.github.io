import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { db } from '@/data/db';
import { ensureSeeded, resetLocalStore } from '@/data/repositories';
import { MeetingsPage } from './MeetingsPage';

const PAST_MEETING = 'Kestrel audit check-in';

function renderMeetings(entry = '/meetings') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <AppProviders>
        <MeetingsPage />
      </AppProviders>
    </MemoryRouter>,
  );
}

/** The notes field and its save button for one meeting, not whichever card sorted first. */
function editor(meetingId: string) {
  const notes = screen.getByLabelText('Notes', { selector: `#notes-${meetingId}` });
  const card = notes.closest('li');
  if (!card) throw new Error(`No card rendered for ${meetingId}`);
  const save = Array.from(card.querySelectorAll('button')).find(
    (button) => button.textContent === 'Save notes',
  );
  if (!save) throw new Error(`No save button rendered for ${meetingId}`);
  return { notes, save };
}

beforeEach(async () => {
  await resetLocalStore(db);
  await ensureSeeded(db, new Date());
});

describe('MeetingsPage', () => {
  it('lists past meetings with the records each one touched', async () => {
    renderMeetings('/meetings?when=past');

    expect(await screen.findByText(PAST_MEETING)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Kestrel Advisory' }).getAttribute('href')).toBe(
      '/crm/company/co-kestrel',
    );
    expect(screen.getByRole('link', { name: 'Iris Santos' }).getAttribute('href')).toBe(
      '/crm/person/p-santos',
    );
  });

  it('writes notes to the local store and confirms what was written', async () => {
    renderMeetings('/meetings?when=past');
    await screen.findByText(PAST_MEETING);

    const kestrel = editor('mtg-kestrel-checkin');
    fireEvent.change(kestrel.notes, { target: { value: 'Budget owner named at last.' } });
    fireEvent.click(kestrel.save);

    await waitFor(async () => {
      expect((await db.meetings.get('mtg-kestrel-checkin'))?.notes).toBe(
        'Budget owner named at last.',
      );
    });
    expect((await db.meetings.get('mtg-kestrel-checkin'))?.touchedAt).toBeDefined();
    expect(await screen.findByText(/Notes recorded for/)).toBeDefined();
  });

  it('keeps the save disabled until the draft differs from the stored notes', async () => {
    renderMeetings('/meetings?when=past');
    await screen.findByText(PAST_MEETING);

    expect(editor('mtg-kestrel-checkin').save.hasAttribute('disabled')).toBe(true);

    fireEvent.change(editor('mtg-kestrel-checkin').notes, {
      target: { value: 'Something new.' },
    });

    expect(editor('mtg-kestrel-checkin').save.hasAttribute('disabled')).toBe(false);
    expect(screen.getAllByText('Unsaved').length).toBe(1);
  });

  it('points at the week view rather than duplicating it', async () => {
    renderMeetings();

    expect((await screen.findByRole('link', { name: 'Calendar' })).getAttribute('href')).toBe(
      '/calendar',
    );
  });
});
