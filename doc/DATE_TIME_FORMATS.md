# Date/Time Format Specification

## Overview

This document specifies the date/time formats used throughout the AI Task Assistant application, the rationale for these choices, and the validation strategy to ensure data integrity.

Key semantic distinction:
- **Date-only fields** (`dueDate`, `endDate`) represent a **local calendar date** (`YYYY-MM-DD`) with **no timezone semantics**.
- **Timestamp fields** (`plannedTime`, `createdAt`, `updatedAt`, notification `time`) represent an **instant in time** stored as **ISO 8601 UTC**.

---

## Format Requirements by Entity

### Task Entity

| Property | Storage Format | Validation | Rationale |
|----------|----------------|------------|-----------|
| `dueDate` | `YYYY-MM-DD` (TEXT) | Must be valid date, ≥ `createdAt` | Date-only is sufficient; time component irrelevant for deadlines |
| `plannedTime` | ISO 8601 full timestamp (TEXT) | Must be valid ISO 8601, ≥ `createdAt` | Specific scheduling time requires precision; UTC storage enables cross-timezone consistency |
| `createdAt` | ISO 8601 full timestamp (TEXT) | Auto-generated, immutable | Audit trail requires precise timestamp |
| `updatedAt` | ISO 8601 full timestamp (TEXT) | Auto-generated | Audit trail requires precise timestamp |
| `duration` | INTEGER (minutes) | Must be > 0 | Simple numeric representation; zero/negative makes no sense |

### Notification Entity

| Property | Storage Format | Validation | Rationale |
|----------|----------------|------------|-----------|
| `time` | ISO 8601 full timestamp (TEXT) | Must be valid ISO 8601 | Scheduling requires precise moment in time |
| `createdAt` | ISO 8601 full timestamp (TEXT) | Auto-generated, immutable | Audit trail |

### RecurrenceRule Entity

| Property | Storage Format | Validation | Rationale |
|----------|----------------|------------|-----------|
| `endDate` | `YYYY-MM-DD` (TEXT) | Must be valid date, ≥ task `createdAt` | Recurrence ends on a day boundary, not specific time |
| `createdAt` | ISO 8601 full timestamp (TEXT) | Auto-generated, immutable | Audit trail |

---

## Rationale for Format Choices

### 1. Date-Only vs. Full Timestamp

**Decision:**
- Use `YYYY-MM-DD` for date-only fields (`dueDate`, `endDate`)
- Use ISO 8601 for timestamp fields (`plannedTime`, `createdAt`, `updatedAt`, notification `time`)

**Rationale:**
- **Simplicity:** Deadlines and recurrence boundaries are day-based; time component adds unnecessary complexity
- **Query performance:** SQLite date comparisons on `YYYY-MM-DD` strings are fast and predictable
- **User clarity:** "Due Jan 15, 2025" is clearer than "Due Jan 15, 2025 00:00:00"
- **Precision when needed:** Timestamps retain full precision for scheduling and audit trails

### 2. UTC Storage with Local Display

**Decision:** Store all timestamps in UTC (via ISO 8601), display in user's local timezone

**Rationale:**
- **Timezone independence:** UTC storage avoids ambiguity; user in Tokyo sees same moment as user in New York (just displayed differently)
- **Daylight saving time:** Automatic handling via browser's `toLocaleString()` methods
- **Data integrity:** Sorting and comparison work correctly regardless of server/client timezone
- **User expectation:** "3pm" means 3pm in *their* timezone, not UTC

### 2.1 Date-Only Fields Are Local Calendar Dates

**Decision:** Treat `YYYY-MM-DD` values as **local calendar dates** and avoid UTC conversions.

**Rationale:**
- **Correctness:** `new Date('YYYY-MM-DD')` is interpreted as **UTC midnight** in JavaScript, which can display/compare as the previous day in negative-offset timezones.
- **Predictable UI:** When a user picks “Jan 15” in a date input, they mean the local day boundary (start/end of that day), not an instant in UTC.
- **Reliable comparisons:** Comparing date-only strings works only if the “today” string is also computed in the **local calendar** (not via `toISOString()`).

**Rule:** Never derive a date-only string via `toISOString().split('T')[0]` because it uses UTC and can shift the day.

### 3. ISO 8601 Standard

**Decision:** Use ISO 8601 (`YYYY-MM-DDTHH:MM:SS.sssZ`) for all timestamps

**Rationale:**
- **Sortable:** Lexicographic sorting equals chronological sorting
- **Unambiguous:** No confusion between DD/MM and MM/DD
- **Standard:** Built-in JavaScript support via `Date.toISOString()` and `new Date(isoString)`
- **Database-friendly:** SQLite TEXT storage with efficient comparisons

---

## Data Flow Architecture

### User/AI Input → Database

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        User / AI Input                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Function Handler (functionHandlers.js)                               │
│                                                                     │
│  • parseToISODateTime(timeString) → converts to ISO 8601             │
│  • formatToYYYYMMDD(dateString) → normalizes to YYYY-MM-DD          │
│  • Validates format, rejects invalid input with error message          │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Model Constructor (Task, Notification, RecurrenceRule)                  │
│                                                                     │
│  • _setDueDate(dateValue) → stores YYYY-MM-DD string             │
│  • _setPlannedTime(timeValue) → stores Date object                 │
│  • validate() → comprehensive validation before DB write               │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  toDatabase() → Convert to storage format                            │
│                                                                     │
│  • Date objects → ISO 8601 string via .toISOString()              │
│  • YYYY-MM-DD strings → stored as-is                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Database (SQLite)                                                  │
│                                                                     │
│  • due_date: TEXT (YYYY-MM-DD)                                   │
│  • planned_time: TEXT (ISO 8601)                               │
│  • created_at: TEXT (ISO 8601)                                  │
│  • updated_at: TEXT (ISO 8601)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database → User Display

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Database Query                                                     │
│  • Returns: TEXT (YYYY-MM-DD or ISO 8601)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Model.fromDatabase(data)                                           │
│                                                                     │
│  • plannedTime/createdAt/updatedAt: new Date(isoString)              │
│  • dueDate/endDate: stored as `YYYY-MM-DD` strings (date-only)       │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Vue Component (TaskItem.vue, ChatMessage.vue)                     │
│                                                                     │
│  • toLocaleDateString() → "1/15/2025"                            │
│  • toLocaleTimeString() → "3:30 PM"                               │
│  • Relative dates: "Today, 3:30 PM", "Tomorrow, 9:00 AM"        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Strategy

### Input Validation (Function Handlers)

**Location:** `app/electron-main/functionHandlers.js`

```javascript
// Example: plannedTime validation
if (args.plannedTime && typeof args.plannedTime === 'string') {
  const isoDateTime = parseToISODateTime(args.plannedTime, 'planned time');
  if (!isoDateTime) {
    return {
      success: false,
      error: `Could not parse date/time from: ${args.plannedTime}`,
      message: `I couldn't process the planned time because the format is invalid: ${args.plannedTime}`
    };
  }
  args.plannedTime = isoDateTime;
}
```

**Acceptable Input Formats (flexible parsing):**
- ISO 8601: `2025-01-15T15:30:00`
- Date + time: `2025-01-15 15:30`, `Jan 15, 2025 3:30 PM`
- Relative: `today`, `tomorrow` (handled by AI, not function handler)

### Date-Only Normalization (Shared Utility)

**Location:** `app/src/utils/dateTime.js`

Use these helpers to keep date-only behavior timezone-safe:
- `coerceDateOnly(value)` → `YYYY-MM-DD` (local calendar)
- `parseDateOnlyLocal('YYYY-MM-DD')` → `Date` at local midnight
- `endOfDayLocalFromDateOnly('YYYY-MM-DD')` → `Date` at local end-of-day
- `getTodayDateOnlyLocal()` → today's local `YYYY-MM-DD`

---

## Error Handling Examples

### Invalid Format

```
Input: { dueDate: "not-a-date" }
       ↓
Error: "Invalid date format for dueDate: not-a-date"
       ↓
Result: Rejected, not stored in database
```

### Invalid Date Range

```
Input: {
  createdAt: "2025-01-10T10:00:00Z",
  dueDate: "2025-01-08"  // Before creation
}
       ↓
Error: "dueDate must be on or after created_at"
       ↓
Result: Rejected, not stored in database
```

### Invalid Duration

```
Input: { duration: -30 }
       ↓
Error: "Duration must be greater than 0"
       ↓
Result: Rejected, not stored in database
```

---

## Timezone Handling

### Assumptions

1. **User input:** User provides time in their local timezone
2. **AI interpretation:** AI receives user timezone context from browser/system
3. **Storage:** All timestamps converted to UTC via `.toISOString()`
4. **Display:** Converted back to user's local timezone via `.toLocaleString()`
5. **Date-only fields:** Stored/compared as local calendar `YYYY-MM-DD` (no UTC conversion)

### Example Flow (User in UTC-8, PST)

```
User says: "Remind me tomorrow at 3pm"
       ↓
AI (via browser Date):
  • "tomorrow" = 2025-01-16
  • "3pm" = 15:00 local time
  • Creates: 2025-01-16 15:00:00 (PST)
       ↓
new Date("2025-01-16 15:00:00")
  • Interpreted as PST (browser local)
  • .toISOString() = "2025-01-16T23:30:00.000Z"
       ↓
Database stores: "2025-01-16T23:30:00.000Z"
       ↓
Retrieved and displayed:
  • new Date("2025-01-16T23:30:00.000Z")
  • .toLocaleTimeString() = "3:30 PM" (back to PST)
```

### Key Point

The system **does not store timezone information**. This is intentional:
- User's device context determines timezone at display time
- Same data renders correctly for users in any timezone
- Avoids timezone migration complexity

---

## Testing Strategy

### Unit Tests for Date-Only Semantics

Prefer direct tests for the shared date-only helpers in `app/src/utils/dateTime.js` to prevent timezone regressions.

### Integration Tests for Function Handlers

```javascript
describe('Function Handler Date/Time Validation', () => {
  test('parseToISODateTime rejects invalid format', async () => {
    const result = parseToISODateTime('not-a-time', 'test');
    expect(result).toBeNull();
  });

  test('parseToISODateTime converts valid time to ISO', async () => {
    const result = parseToISODateTime('2025-01-15 15:30', 'test');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  test('formatToYYYYMMDD normalizes date', async () => {
    const result = formatToYYYYMMDD('January 15, 2025');
    expect(result).toBe('2025-01-15');
  });
});
```

---

## Migration Notes

### No Database Migration Required

The database schema already uses the correct formats:
- `due_date TEXT` → stores `YYYY-MM-DD`
- `planned_time TEXT` → stores ISO 8601
- `created_at TEXT` → stores ISO 8601

Legacy safety note:
- If older rows contain `due_date` values with a time component, they should be normalized to `YYYY-MM-DD` by the model/utilities before use and on writeback.

---

## References

- **ISO 8601:** [RFC 3339](https://datatracker.ietf.org/doc/html/rfc3339)
- **SQLite Date Storage:** [SQLite Query Language](https://www.sqlite.org/lang_datefunc.html)
- **JavaScript Date:** [MDN Date Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date)
- **Related Issue:** `doc/ISSUES.json` → TASK-250627-009
