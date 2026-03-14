const { checkPersonalEvents, getCSTDate } = require('../utils/resource');

describe('daka -> checkPersonalEvents', () => {
  it('no events', () => {
    expect(checkPersonalEvents()).toBe(false);
    expect(
      checkPersonalEvents({
        events: [],
        today: '2022-09-30',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events: [],
        today: '2022-09-30',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);
  });

  it('partial events 1, 2022-10-05 from 13:00 to 17:00', () => {
    const events = [testEvents[2]];

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);
  });

  it('partial events 2, 2022-10-17 from 14:00 to 19:00', () => {
    const events = [testEvents[3]];

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-17',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-17',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-17',
        hour: '18',
        min: '57',
        punchType: 'E',
      })
    ).toBe(true);
  });

  it('partial events 3, 2022-10-21 from 10:00 to 15:00', () => {
    const events = [testEvents[4]];

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-21',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-21',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-21',
        hour: '10',
        min: '7',
        punchType: 'S',
      })
    ).toBe(true);
  });

  it('an all day event', () => {
    const events = [testEvents[1]];

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-04',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-04',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);
  });

  it('multiple all day event', () => {
    const events = [testEvents[0]];

    expect(
      checkPersonalEvents({
        events,
        today: '2022-09-30',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-09-30',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);
  });

  it('all events', () => {
    const events = testEvents;

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-03',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-05',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-17',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(false);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-17',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-21',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-21',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(false);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-04',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-10-04',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);

    expect(
      checkPersonalEvents({
        events,
        today: '2022-09-30',
        hour: '9',
        min: '57',
        punchType: 'S',
      })
    ).toBe(true);
    expect(
      checkPersonalEvents({
        events,
        today: '2022-09-30',
        hour: '19',
        min: '13',
        punchType: 'E',
      })
    ).toBe(true);
  });
});

const testEvents = [
  {
    startDateTime: '2022-09-27T10:00:00+00:00',
    endDateTime: '2022-09-30T19:00:00+00:00',
  },
  {
    startDateTime: '2022-10-04T10:00:00+00:00',
    endDateTime: '2022-10-04T19:00:00+00:00',
  },
  {
    startDateTime: '2022-10-05T13:00:00+00:00',
    endDateTime: '2022-10-05T17:00:00+00:00',
  },
  {
    startDateTime: '2022-10-17T14:00:00+00:00',
    endDateTime: '2022-10-17T19:00:00+00:00',
  },
  {
    startDateTime: '2022-10-21T10:00:00+00:00',
    endDateTime: '2022-10-21T15:00:00+00:00',
  },
];
