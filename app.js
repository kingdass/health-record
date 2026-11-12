(() => {
  "use strict";

  const STORAGE_KEY = "jiankang-jilu:v1";
  const DEFAULT_NICKNAME = "小水滴";
  const NICKNAME_MAX_LENGTH = 12;
  const WATER_GOAL = 2000;
  const WATER_STEP = 250;
  const RING_CIRCUMFERENCE = 2 * Math.PI * 56;
  const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
  const MIN_DATE_KEY = "2000-01-01";
  const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const MONTH_LABELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

  const EXERCISES = {
    run: {
      label: "跑步",
      emoji: "🏃",
      hint: "记录今天的跑步公里数和时长。",
      action: "记录跑步",
    },
    fitness: {
      label: "健身",
      emoji: "🏋️",
      hint: "记录今天的健身时长，按分钟计算。",
      action: "记录健身",
    },
    stretch: {
      label: "拉伸",
      emoji: "🧘",
      hint: "记录今天的拉伸时长，按分钟计算。",
      action: "记录拉伸",
    },
  };
  const EXERCISE_ORDER = ["run", "fitness", "stretch"];

  // 首次打开时随机分配三种运动色，并随昵称、记录一起保存在 localStorage。
  const PALETTE = [
    { key: "coral", main: "#c94b35", soft: "#fff0eb", deep: "#a23a26" },
    { key: "teal", main: "#087c73", soft: "#e7f8f5", deep: "#056b63" },
    { key: "violet", main: "#5e45d6", soft: "#f1edff", deep: "#4b32b8" },
    { key: "rose", main: "#c22e5a", soft: "#fff0f4", deep: "#a12248" },
    { key: "indigo", main: "#3455c7", soft: "#edf2ff", deep: "#2943a4" },
    { key: "forest", main: "#2d7a3e", soft: "#edf8ef", deep: "#23622f" },
  ];
  const PALETTE_BY_KEY = Object.fromEntries(PALETTE.map((color) => [color.key, color]));
  // 每次初始分配从一组协调的三色中抽取，兼顾随机感和整体清爽度。
  const COLOR_SETS = [
    ["coral", "teal", "violet"],
    ["indigo", "coral", "teal"],
    ["violet", "forest", "rose"],
    ["teal", "rose", "indigo"],
    ["coral", "forest", "violet"],
    ["indigo", "rose", "teal"],
  ];

  const numberFormatter = new Intl.NumberFormat("zh-CN");
  const kmFormatter = new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 2,
  });

  const dom = {
    todayChip: document.querySelector("#todayChip"),
    nicknameText: document.querySelector("#nicknameText"),
    editNicknameBtn: document.querySelector("#editNicknameBtn"),
    nicknameEditor: document.querySelector("#nicknameEditor"),
    nicknameInput: document.querySelector("#nicknameInput"),
    cancelNicknameBtn: document.querySelector("#cancelNicknameBtn"),

    waterProgress: document.querySelector("#waterProgress"),
    waterRing: document.querySelector("#waterRing"),
    waterTotal: document.querySelector("#waterTotal"),
    waterPercent: document.querySelector("#waterPercent"),
    waterRemainingPct: document.querySelector("#waterRemainingPct"),
    waterRemaining: document.querySelector("#waterRemaining"),
    waterNote: document.querySelector("#waterNote"),
    waterStatus: document.querySelector("#waterStatus"),
    addWaterBtn: document.querySelector("#addWaterBtn"),
    addWaterLabel: document.querySelector("#addWaterLabel"),
    waterDateRow: document.querySelector("#waterDateRow"),
    waterDateInput: document.querySelector("#waterDateInput"),
    waterDateBadge: document.querySelector("#waterDateBadge"),
    waterDateReset: document.querySelector("#waterDateReset"),
    waterBackfillNote: document.querySelector("#waterBackfillNote"),
    waterRecordList: document.querySelector("#waterRecordList"),
    waterEmpty: document.querySelector("#waterEmpty"),
    waterCount: document.querySelector("#waterCount"),

    exerciseTotal: document.querySelector("#exerciseTotal"),
    exerciseSwitch: document.querySelector("#exerciseSwitch"),
    exerciseTabs: Array.from(document.querySelectorAll(".exercise-tab")),
    exerciseForm: document.querySelector("#exerciseForm"),
    exerciseFormBox: document.querySelector("#exerciseFormBox"),
    exerciseHint: document.querySelector("#exerciseHint"),
    exerciseHintText: document.querySelector("#exerciseHintText"),
    runFields: document.querySelector("#runFields"),
    minuteFields: document.querySelector("#minuteFields"),
    runKmInput: document.querySelector("#runKmInput"),
    runMinutesInput: document.querySelector("#runMinutesInput"),
    minutesInput: document.querySelector("#minutesInput"),
    minuteFieldLabel: document.querySelector("#minuteFieldLabel"),
    minuteQuickPicks: document.querySelector("#minuteQuickPicks"),
    quickPickButtons: Array.from(document.querySelectorAll(".quick-pick")),
    exerciseError: document.querySelector("#exerciseError"),
    saveExerciseBtn: document.querySelector("#saveExerciseBtn"),
    saveExerciseLabel: document.querySelector("#saveExerciseLabel"),
    exerciseSummary: document.querySelector("#exerciseSummary"),
    exerciseEmpty: document.querySelector("#exerciseEmpty"),
    exerciseCount: document.querySelector("#exerciseCount"),
    exerciseDateRow: document.querySelector("#exerciseDateRow"),
    exerciseDateInput: document.querySelector("#exerciseDateInput"),
    exerciseDateBadge: document.querySelector("#exerciseDateBadge"),
    exerciseDateReset: document.querySelector("#exerciseDateReset"),
    exerciseBackfillNote: document.querySelector("#exerciseBackfillNote"),
    historyDay: document.querySelector("#historyDay"),
    calendarMonthLabel: document.querySelector("#calendarMonthLabel"),
    calendarTodayHint: document.querySelector("#calendarTodayHint"),
    calendarGrid: document.querySelector("#calendarGrid"),
    prevMonthBtn: document.querySelector("#prevMonthBtn"),
    nextMonthBtn: document.querySelector("#nextMonthBtn"),
    calendarTodayBtn: document.querySelector("#calendarTodayBtn"),
    toast: document.querySelector("#toast"),
  };

  let selectedExercise = "run";
  let state = loadState();
  let currentDayKey = getDayKey(Date.now());
  let waterDraftDateKey = currentDayKey;
  let exerciseDraftDateKey = currentDayKey;
  let selectedHistoryDate = currentDayKey;
  let historyMonth = getBeijingParts(Date.now()).month;
  let historyYear = getBeijingParts(Date.now()).year;
  let toastTimer = 0;
  let storageWarningShown = false;

  init();

  function init() {
    updateDateChip();
    bindEvents();
    renderAll();
    persist({ silent: true });

    window.setInterval(checkDayRollover, 30000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        updateDateChip();
        checkDayRollover();
      }
    });
    window.addEventListener("storage", handleStorageEvent);
  }

  /* ---------- data ---------- */

  function createInitialState() {
    const colors = shuffle([...COLOR_SETS[Math.floor(Math.random() * COLOR_SETS.length)]]);
    return {
      nickname: DEFAULT_NICKNAME,
      colors: {
        run: colors[0],
        fitness: colors[1],
        stretch: colors[2],
      },
      records: [],
    };
  }

  function loadState() {
    let raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      return createInitialState();
    }

    if (!raw) {
      return createInitialState();
    }

    try {
      return normalizeState(JSON.parse(raw));
    } catch {
      return createInitialState();
    }
  }

  function normalizeState(raw) {
    const fallback = createInitialState();
    if (!raw || typeof raw !== "object") {
      return fallback;
    }

    const nickname =
      typeof raw.nickname === "string" && raw.nickname.trim()
        ? limitText(raw.nickname.trim().replace(/\s+/g, " "), NICKNAME_MAX_LENGTH)
        : DEFAULT_NICKNAME;

    const records = [];
    const seenIds = new Set();
    const sourceRecords = Array.isArray(raw.records) ? raw.records : [];

    for (const item of sourceRecords) {
      if (!item || typeof item !== "object") continue;

      const ts = Number(item.ts);
      if (!Number.isFinite(ts) || ts <= 0) continue;

      const kind = item.kind;
      if (kind !== "water" && !EXERCISE_ORDER.includes(kind)) continue;

      let record = {
        id:
          typeof item.id === "string" && item.id
            ? item.id
            : createRecordId(),
        kind,
        ts: Math.round(ts),
      };

      if (kind === "water") {
        const amount = Number(item.amount);
        record.amount =
          Number.isFinite(amount) && amount > 0 && amount <= 5000
            ? Math.round(amount)
            : WATER_STEP;
      } else if (kind === "run") {
        const km = Number(item.km);
        const minutes = Number(item.minutes);
        if (
          !Number.isFinite(km) ||
          km <= 0 ||
          km > 200 ||
          !Number.isFinite(minutes) ||
          minutes <= 0 ||
          minutes > 1440
        ) {
          continue;
        }
        record.km = Math.round(km * 100) / 100;
        record.minutes = Math.round(minutes);
      } else {
        const minutes = Number(item.minutes);
        if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) {
          continue;
        }
        record.minutes = Math.round(minutes);
      }

      if (seenIds.has(record.id)) {
        record.id = createRecordId();
      }
      seenIds.add(record.id);
      records.push(record);
    }

    records.sort((a, b) => a.ts - b.ts);

    return {
      nickname,
      colors: normalizeColors(raw.colors),
      records,
    };
  }

  function normalizeColors(rawColors) {
    if (rawColors && typeof rawColors === "object") {
      const used = new Set();
      const normalized = {};
      let valid = true;

      for (const kind of EXERCISE_ORDER) {
        const key = rawColors[kind];
        if (typeof key !== "string" || !PALETTE_BY_KEY[key] || used.has(key)) {
          valid = false;
          break;
        }
        used.add(key);
        normalized[kind] = key;
      }

      if (valid) return normalized;
    }

    return createInitialState().colors;
  }

  function persist({ silent = false } = {}) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      if (!silent && !storageWarningShown) {
        storageWarningShown = true;
        showToast("当前浏览器无法保存数据，刷新后记录会重置");
      }
    }
  }

  function recordsForDay(dayKey) {
    return state.records.filter(
      (record) => getDayKey(record.ts) === dayKey
    );
  }

  function todayRecords() {
    return recordsForDay(currentDayKey);
  }

  function colorFor(kind) {
    return PALETTE_BY_KEY[state.colors[kind]] || PALETTE[0];
  }

  /* ---------- render ---------- */

  function renderAll() {
    renderDate();
    renderWater();
    renderExercise();
    renderExerciseForm();
    syncRecordDateControls();
    renderHistory();
  }

  function renderDate() {
    const parts = getBeijingParts(Date.now());
    dom.todayChip.textContent = `${parts.month + 1}月${parts.day}日 ${
      WEEKDAYS[parts.weekday]
    }`;
    dom.todayChip.dateTime = currentDayKey;
    dom.nicknameText.textContent = state.nickname;
    dom.nicknameText.title = state.nickname;
  }

  function renderWater() {
    const records = todayRecords()
      .filter((record) => record.kind === "water")
      .sort((a, b) => b.ts - a.ts);
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const ratio = Math.min(1, total / WATER_GOAL);
    const roundedPercent = Math.min(100, Math.round((total / WATER_GOAL) * 100));
    const percent = total < WATER_GOAL ? Math.min(99, roundedPercent) : 100;
    const remainingPercent = 100 - percent;
    const remainingMl = Math.max(0, WATER_GOAL - total);

    dom.waterTotal.textContent = numberFormatter.format(total);
    dom.waterRing.style.strokeDashoffset = String(
      RING_CIRCUMFERENCE * (1 - ratio)
    );
    dom.waterPercent.textContent = `${percent}%`;
    dom.waterRemainingPct.textContent = `${remainingPercent}%`;
    dom.waterRemaining.textContent = numberFormatter.format(remainingMl);
    dom.waterCount.textContent = `${records.length} 次`;
    dom.waterEmpty.hidden = records.length > 0;
    dom.waterRecordList.hidden = records.length === 0;

    dom.waterProgress.setAttribute("aria-valuenow", String(percent));
    dom.waterProgress.setAttribute(
      "aria-valuetext",
      `今日已饮 ${total} 毫升，完成 ${percent}%，距离目标还差 ${remainingMl} 毫升`
    );

    dom.waterStatus.classList.toggle("is-done", total >= WATER_GOAL);
    dom.waterStatus.textContent =
      total === 0 ? "未开始" : total >= WATER_GOAL ? "已达标" : "进行中";

    if (total === 0) {
      dom.waterNote.textContent = "第一杯水，等你来记录。";
    } else if (total < WATER_GOAL) {
      dom.waterNote.textContent = `再喝 ${numberFormatter.format(
        remainingMl
      )} ml 就达成目标。`;
    } else if (total === WATER_GOAL) {
      dom.waterNote.textContent = "目标达成，今天的水分补给刚刚好。";
    } else {
      dom.waterNote.textContent = `目标已超额完成 ${numberFormatter.format(
        total - WATER_GOAL
      )} ml，记得适量饮水。`;
    }

    const rows = records.map((record) => {
      const text = document.createDocumentFragment();
      text.append("饮水 ");
      const strong = document.createElement("strong");
      strong.textContent = `${numberFormatter.format(record.amount)} ml`;
      text.append(strong);
      return createRecordRow({
        record,
        text,
        label: "饮水",
      });
    });
    dom.waterRecordList.replaceChildren(...rows);
  }

  function renderExercise() {
    const records = todayRecords().filter((record) => record.kind !== "water");
    const totalMinutes = records.reduce(
      (sum, record) => sum + record.minutes,
      0
    );
    const recordedKinds = EXERCISE_ORDER.filter((kind) =>
      records.some((record) => record.kind === kind)
    );

    dom.exerciseTotal.textContent = recordedKinds.length
      ? `${numberFormatter.format(totalMinutes)} 分钟`
      : "0 分钟";
    dom.exerciseCount.textContent = `${recordedKinds.length} 项`;
    dom.exerciseEmpty.hidden = recordedKinds.length > 0;
    dom.exerciseSummary.hidden = recordedKinds.length === 0;

    const groups = buildExerciseGroups(records, {
      subheading: "今日合计",
      ariaLabelPrefix: "今日",
    });
    dom.exerciseSummary.replaceChildren(...groups);
    renderExerciseTabs();
  }

  function buildExerciseGroups(
    records,
    { subheading = "今日合计", ariaLabelPrefix = "今日" } = {}
  ) {
    const recordedKinds = EXERCISE_ORDER.filter((kind) =>
      records.some((record) => record.kind === kind)
    );

    return recordedKinds.map((kind) => {
      const info = EXERCISES[kind];
      const color = colorFor(kind);
      const kindRecords = records
        .filter((record) => record.kind === kind)
        .sort((a, b) => b.ts - a.ts);
      const minutes = kindRecords.reduce(
        (sum, record) => sum + record.minutes,
        0
      );
      const kilometers =
        kind === "run"
          ? kindRecords.reduce((sum, record) => sum + record.km, 0)
          : 0;

      const group = document.createElement("article");
      group.className = "exercise-group";
      group.style.setProperty("--accent", color.main);
      group.style.setProperty("--accent-soft", color.soft);
      group.style.setProperty("--accent-deep", color.deep);

      const head = document.createElement("div");
      head.className = "exercise-group__head";

      const icon = document.createElement("span");
      icon.className = "exercise-group__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = info.emoji;

      const title = document.createElement("div");
      title.className = "exercise-group__title";
      const heading = document.createElement("h4");
      heading.textContent = info.label;
      const subheadingElement = document.createElement("p");
      subheadingElement.textContent = subheading;
      title.append(heading, subheadingElement);

      const total = document.createElement("div");
      total.className = "exercise-group__total";
      total.append(
        kind === "run"
          ? `${kmFormatter.format(kilometers)} km`
          : `${numberFormatter.format(minutes)} 分钟`
      );
      const totalDetail = document.createElement("small");
      totalDetail.textContent =
        kind === "run"
          ? `${numberFormatter.format(minutes)} 分钟 · ${kindRecords.length} 次`
          : `${kindRecords.length} 次`;
      total.append(totalDetail);

      head.append(icon, title, total);

      const list = document.createElement("ul");
      list.className = "exercise-records";
      list.setAttribute("aria-label", `${info.label}${ariaLabelPrefix}记录`);
      kindRecords.forEach((record) => {
        const text = document.createElement("span");
        text.textContent =
          kind === "run"
            ? `${kmFormatter.format(record.km)} km · ${numberFormatter.format(
                record.minutes
              )} 分钟`
            : `${numberFormatter.format(record.minutes)} 分钟`;
        list.append(
          createRecordRow({
            record,
            text,
            label: info.label,
          })
        );
      });

      group.append(head, list);
      return group;
    });
  }

  function renderExerciseTabs() {
    dom.exerciseTabs.forEach((tab) => {
      const kind = tab.dataset.exercise;
      const color = colorFor(kind);
      tab.style.setProperty("--accent", color.main);
      tab.style.setProperty("--accent-soft", color.soft);
      tab.style.setProperty("--accent-deep", color.deep);
      const selected = kind === selectedExercise;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      tab.setAttribute("aria-controls", "exerciseForm");
    });

    const colors = colorFor(selectedExercise);
    dom.exerciseFormBox.style.setProperty("--accent", colors.main);
    dom.exerciseFormBox.style.setProperty("--accent-deep", colors.deep);
    dom.exerciseFormBox.style.setProperty("--accent-soft", colors.soft);
  }

  function renderExerciseForm() {
    const info = EXERCISES[selectedExercise];
    const isRun = selectedExercise === "run";

    dom.exerciseHint.firstElementChild.textContent = info.emoji;
    dom.exerciseHintText.textContent = info.hint;
    dom.runFields.hidden = !isRun;
    dom.minuteFields.hidden = isRun;
    dom.minuteQuickPicks.hidden = isRun;
    dom.saveExerciseLabel.textContent = info.action;
    dom.minuteFieldLabel.textContent = `${info.label}时长`;
    dom.minutesInput.placeholder = selectedExercise === "stretch" ? "如 10" : "如 30";
    hideExerciseError();
    syncDateControl("exercise");
  }

  function createRecordRow({ record, text, label, ariaDate = "" }) {
    const item = document.createElement("li");
    item.className = "record-item";

    const time = document.createElement("time");
    time.dateTime = new Date(record.ts).toISOString();
    time.textContent = formatTime(record.ts);

    const dot = document.createElement("span");
    dot.className = "record-dot";
    dot.setAttribute("aria-hidden", "true");

    const textElement = document.createElement("span");
    textElement.className = "record-text";
    if (typeof text === "string") {
      textElement.textContent = text;
    } else {
      textElement.append(text);
    }

    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "undo-button";
    undo.textContent = "×";
    undo.dataset.removeId = record.id;
    undo.setAttribute(
      "aria-label",
      `撤销 ${ariaDate ? `${ariaDate} ` : ""}${formatTime(record.ts)} 的${label}记录`
    );
    undo.title = "撤销这条记录";

    item.append(time, dot, textElement, undo);
    return item;
  }

  /* ---------- record date / backfill ---------- */

  function getDraftDateKey(kind) {
    return kind === "water" ? waterDraftDateKey : exerciseDraftDateKey;
  }

  function setDraftDateKey(kind, dateKey) {
    if (kind === "water") {
      waterDraftDateKey = dateKey;
    } else {
      exerciseDraftDateKey = dateKey;
    }
  }

  function syncRecordDateControls() {
    syncDateControl("water");
    syncDateControl("exercise");
  }

  function syncDateControl(kind) {
    const isWater = kind === "water";
    const dateKey = getDraftDateKey(kind);
    const isToday = dateKey === currentDayKey;
    const refs = isWater
      ? {
          row: dom.waterDateRow,
          input: dom.waterDateInput,
          badge: dom.waterDateBadge,
          reset: dom.waterDateReset,
          note: dom.waterBackfillNote,
        }
      : {
          row: dom.exerciseDateRow,
          input: dom.exerciseDateInput,
          badge: dom.exerciseDateBadge,
          reset: dom.exerciseDateReset,
          note: dom.exerciseBackfillNote,
        };

    refs.input.max = currentDayKey;
    refs.input.value = dateKey;
    refs.row.classList.toggle("is-backfill", !isToday);
    refs.badge.textContent = isToday ? "今天" : "补记";
    refs.reset.hidden = isToday;
    refs.note.hidden = isToday;
    refs.note.textContent = isToday
      ? ""
      : `这笔${isWater ? "饮水" : "运动"}会计入 ${formatShortDate(
          dateKey
        )}，不计入今天。`;

    if (isWater) {
      dom.addWaterLabel.textContent = isToday
        ? "记录 250 ml"
        : `补记 250 ml 到 ${formatShortDate(dateKey)}`;
    } else {
      const info = EXERCISES[selectedExercise];
      dom.saveExerciseLabel.textContent = isToday
        ? info.action
        : `补记${info.label} · ${formatShortDate(dateKey)}`;
    }
  }

  function handleDraftDateChange(kind) {
    const input =
      kind === "water" ? dom.waterDateInput : dom.exerciseDateInput;
    const dateKey = input.value;

    if (!dateKey) {
      setDraftDateKey(kind, currentDayKey);
      syncDateControl(kind);
      return;
    }

    if (!isValidDayKey(dateKey) || dateKey < MIN_DATE_KEY) {
      showToast("请选择有效的日期");
      setDraftDateKey(kind, currentDayKey);
      syncDateControl(kind);
      return;
    }

    if (dateKey > currentDayKey) {
      showToast("不能记录到未来日期");
      setDraftDateKey(kind, currentDayKey);
      syncDateControl(kind);
      return;
    }

    setDraftDateKey(kind, dateKey);
    syncDateControl(kind);
  }

  function resetDraftDate(kind) {
    setDraftDateKey(kind, currentDayKey);
    syncDateControl(kind);
  }

  function validateRecordDate(dateKey) {
    if (!isValidDayKey(dateKey) || dateKey < MIN_DATE_KEY) {
      showToast("请选择有效的记录日期");
      return false;
    }
    if (dateKey > currentDayKey) {
      showToast("不能记录到未来日期");
      return false;
    }
    return true;
  }

  function getRecordTimestamp(dateKey) {
    if (dateKey === currentDayKey) {
      return Date.now();
    }
    const now = getBeijingParts(Date.now());
    return Date.parse(
      `${dateKey}T${pad2(now.hours)}:${pad2(now.minutes)}:${pad2(
        now.seconds
      )}+08:00`
    );
  }

  /* ---------- history ---------- */

  function renderHistory() {
    renderCalendar();
    renderHistoryDay();
  }

  function renderCalendar() {
    const now = getBeijingParts(Date.now());
    const monthKey = `${historyYear}-${pad2(historyMonth + 1)}`;
    const currentMonthKey = `${now.year}-${pad2(now.month + 1)}`;

    dom.calendarMonthLabel.textContent = `${historyYear}年${
      MONTH_LABELS[historyMonth]
    }月`;
    dom.calendarTodayHint.textContent = `今天 ${now.month + 1}月${now.day}日`;
    dom.nextMonthBtn.disabled = monthKey >= currentMonthKey;
    dom.prevMonthBtn.disabled =
      historyYear < 2000 || (historyYear === 2000 && historyMonth === 0);

    const recordDays = new Set();
    state.records.forEach((record) => {
      recordDays.add(getDayKey(record.ts));
    });

    const firstWeekday = new Date(
      Date.UTC(historyYear, historyMonth, 1)
    ).getUTCDay();
    const leadingBlanks = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(
      Date.UTC(historyYear, historyMonth + 1, 0)
    ).getUTCDate();
    const cells = [];

    for (let index = 0; index < leadingBlanks; index += 1) {
      const blank = document.createElement("span");
      blank.className = "calendar-blank";
      blank.setAttribute("aria-hidden", "true");
      cells.push(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dateKey = `${historyYear}-${pad2(historyMonth + 1)}-${pad2(day)}`;
      const weekday = new Date(
        Date.UTC(historyYear, historyMonth, day)
      ).getUTCDay();
      const isToday = dateKey === currentDayKey;
      const isFuture = dateKey > currentDayKey;
      const isSelected = dateKey === selectedHistoryDate;
      const hasRecord = recordDays.has(dateKey);

      const button = document.createElement("button");
      button.type = "button";
      button.className = "calendar-day";
      button.dataset.date = dateKey;
      button.textContent = String(day);
      button.disabled = isFuture;
      button.setAttribute("aria-pressed", String(isSelected));
      button.setAttribute(
        "aria-label",
        `${historyYear}年${historyMonth + 1}月${day}日 ${WEEKDAYS[weekday]}${
          isToday ? "，今天" : ""
        }${hasRecord ? "，有记录" : "，暂无记录"}`
      );
      if (hasRecord) button.classList.add("has-record");
      if (isToday) {
        button.classList.add("is-today");
        button.setAttribute("aria-current", "date");
      }
      if (isSelected) button.classList.add("is-selected");
      if (isFuture) button.setAttribute("aria-disabled", "true");
      cells.push(button);
    }

    dom.calendarGrid.replaceChildren(...cells);
  }

  function renderHistoryDay() {
    const parts = getBeijingParts(parseDayKeyTimestamp(selectedHistoryDate));
    const isToday = selectedHistoryDate === currentDayKey;
    const dayRecords = recordsForDay(selectedHistoryDate);
    const waterRecords = dayRecords
      .filter((record) => record.kind === "water")
      .sort((a, b) => b.ts - a.ts);
    const exerciseRecords = dayRecords
      .filter((record) => record.kind !== "water")
      .sort((a, b) => b.ts - a.ts);
    const waterTotal = waterRecords.reduce(
      (sum, record) => sum + record.amount,
      0
    );
    const exerciseMinutes = exerciseRecords.reduce(
      (sum, record) => sum + record.minutes,
      0
    );
    const exerciseKinds = EXERCISE_ORDER.filter((kind) =>
      exerciseRecords.some((record) => record.kind === kind)
    );

    const head = document.createElement("div");
    head.className = "history-day__head";

    const dateWrap = document.createElement("div");
    dateWrap.className = "history-day__date";
    const heading = document.createElement("h3");
    heading.textContent = `${parts.month + 1}月${parts.day}日 ${
      WEEKDAYS[parts.weekday]
    }`;
    const meta = document.createElement("p");
    meta.textContent = `${parts.year}年 · ${
      isToday ? "今天" : "历史记录"
    } · 北京时间`;
    dateWrap.append(heading, meta);

    const badge = document.createElement("span");
    badge.className = "history-day__badge";
    badge.textContent = isToday ? "今天" : "历史";
    if (!isToday) badge.classList.add("is-history");
    head.append(dateWrap, badge);

    if (dayRecords.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state history-none";
      const icon = document.createElement("span");
      icon.className = "empty-state__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🗓️";
      const text = document.createElement("span");
      text.textContent = "这一天暂无记录。可以在上方记录时选择日期补记。";
      empty.append(icon, text);
      dom.historyDay.replaceChildren(head, empty);
      return;
    }

    const summary = document.createElement("div");
    summary.className = "history-summary";
    summary.append(
      createHistoryStat(
        "饮水",
        waterTotal,
        "ml",
        "history-stat--water",
        `${waterRecords.length} 次`
      ),
      createHistoryStat(
        "运动",
        exerciseMinutes,
        "分钟",
        "history-stat--exercise",
        `${exerciseKinds.length} 项`
      )
    );

    const sections = [];
    sections.push(
      createHistorySection({
        title: "饮水记录",
        totalText: `合计 ${numberFormatter.format(waterTotal)} ml · ${
          waterRecords.length
        } 次`,
        records: waterRecords,
        type: "water",
      })
    );
    sections.push(
      createHistoryExerciseSection(exerciseRecords, {
        title: "运动记录",
        totalText: `合计 ${numberFormatter.format(exerciseMinutes)} 分钟 · ${
          exerciseKinds.length
        } 项`,
      })
    );

    dom.historyDay.replaceChildren(head, summary, ...sections);
  }

  function createHistoryStat(label, value, unit, className, countText) {
    const stat = document.createElement("div");
    stat.className = `history-stat ${className}`;
    const labelElement = document.createElement("span");
    labelElement.className = "history-stat__label";
    labelElement.textContent = `${label} · ${countText}`;
    const strong = document.createElement("strong");
    strong.textContent = numberFormatter.format(value);
    const unitElement = document.createElement("small");
    unitElement.textContent = unit;
    strong.append(unitElement);
    stat.append(labelElement, strong);
    return stat;
  }

  function createHistorySection({ title, totalText, records, type }) {
    const section = document.createElement("section");
    section.className = "history-section";
    const head = document.createElement("div");
    head.className = "history-section__head";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const total = document.createElement("span");
    total.textContent = totalText;
    head.append(heading, total);
    section.append(head);

    if (records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty-line";
      empty.textContent =
        type === "water" ? "暂无饮水记录" : "暂无运动记录";
      section.append(empty);
      return section;
    }

    const list = document.createElement("ul");
    list.className = "record-list";
    list.setAttribute("aria-label", `${formatShortDate(selectedHistoryDate)}${title}`);
    records.forEach((record) => {
      const text = document.createDocumentFragment();
      text.append("饮水 ");
      const strong = document.createElement("strong");
      strong.textContent = `${numberFormatter.format(record.amount)} ml`;
      text.append(strong);
      list.append(
        createRecordRow({
          record,
          text,
          label: "饮水",
          ariaDate: formatShortDate(selectedHistoryDate),
        })
      );
    });
    section.append(list);
    return section;
  }

  function createHistoryExerciseSection(records, { title, totalText }) {
    const section = document.createElement("section");
    section.className = "history-section";
    const head = document.createElement("div");
    head.className = "history-section__head";
    const heading = document.createElement("h4");
    heading.textContent = title;
    const total = document.createElement("span");
    total.textContent = totalText;
    head.append(heading, total);
    section.append(head);

    if (records.length === 0) {
      const empty = document.createElement("div");
      empty.className = "history-empty-line";
      empty.textContent = "暂无运动记录";
      section.append(empty);
      return section;
    }

    const groups = buildExerciseGroups(records, {
      subheading: "当日合计",
      ariaLabelPrefix: "当日",
    });
    section.append(...groups);
    return section;
  }

  function setHistorySelection(dateKey) {
    selectedHistoryDate = dateKey;
    const parts = getBeijingParts(parseDayKeyTimestamp(dateKey));
    historyYear = parts.year;
    historyMonth = parts.month;
  }

  function changeHistoryMonth(delta) {
    const date = new Date(Date.UTC(historyYear, historyMonth + delta, 1));
    const candidateYear = date.getUTCFullYear();
    const candidateMonth = date.getUTCMonth();
    const now = getBeijingParts(Date.now());

    if (
      candidateYear < 2000 ||
      candidateYear > now.year ||
      (candidateYear === now.year && candidateMonth > now.month)
    ) {
      return;
    }

    historyYear = candidateYear;
    historyMonth = candidateMonth;
    renderCalendar();
  }

  function selectHistoryDate(dateKey) {
    if (!isValidDayKey(dateKey) || dateKey > currentDayKey) return;
    setHistorySelection(dateKey);
    renderHistory();
  }

  function goToTodayHistory() {
    setHistorySelection(currentDayKey);
    renderHistory();
  }

  /* ---------- actions ---------- */

  function addWater() {
    checkDayRollover();
    const dateKey = getDraftDateKey("water");
    if (!validateRecordDate(dateKey)) return;

    const wasBackfill = dateKey !== currentDayKey;
    state.records.push({
      id: createRecordId(),
      kind: "water",
      amount: WATER_STEP,
      ts: getRecordTimestamp(dateKey),
    });
    persist();

    if (wasBackfill) {
      setHistorySelection(dateKey);
      waterDraftDateKey = currentDayKey;
    }
    renderAll();
    if (!wasBackfill) bumpWaterTotal();
    showToast(
      wasBackfill
        ? `已补记 250 ml 到 ${formatShortDate(dateKey)}（不计入今天）`
        : `已记录 ${WATER_STEP} ml 饮水`
    );
  }

  function bumpWaterTotal() {
    dom.waterTotal.classList.remove("is-bumped");
    void dom.waterTotal.offsetWidth;
    dom.waterTotal.classList.add("is-bumped");
    window.setTimeout(() => dom.waterTotal.classList.remove("is-bumped"), 380);
  }

  function selectExercise(kind, { focus = false } = {}) {
    if (!EXERCISES[kind] || selectedExercise === kind) {
      if (focus) {
        dom.exerciseTabs.find((tab) => tab.dataset.exercise === kind)?.focus();
      }
      return;
    }
    selectedExercise = kind;
    renderExerciseTabs();
    renderExerciseForm();
    if (focus) {
      dom.exerciseTabs.find((tab) => tab.dataset.exercise === kind)?.focus();
    }
  }

  function submitExercise(event) {
    event.preventDefault();
    checkDayRollover();
    hideExerciseError();

    const dateKey = getDraftDateKey("exercise");
    if (!validateRecordDate(dateKey)) return;

    let record;

    if (selectedExercise === "run") {
      const km = Number.parseFloat(dom.runKmInput.value);
      const minutes = Number.parseFloat(dom.runMinutesInput.value);

      if (!Number.isFinite(km) || km <= 0) {
        showExerciseError("请填写大于 0 的跑步公里数。", dom.runKmInput);
        return;
      }
      if (km > 200) {
        showExerciseError("公里数有点多啦，请填写 200 km 以内的数值。", dom.runKmInput);
        return;
      }
      if (!Number.isFinite(minutes) || minutes <= 0) {
        showExerciseError("请填写大于 0 的跑步时长。", dom.runMinutesInput);
        return;
      }
      if (minutes > 1440) {
        showExerciseError("时长请填写 1440 分钟以内。", dom.runMinutesInput);
        return;
      }

      record = {
        id: createRecordId(),
        kind: "run",
        ts: getRecordTimestamp(dateKey),
        km: Math.round(km * 100) / 100,
        minutes: Math.round(minutes),
      };
    } else {
      const minutes = Number.parseFloat(dom.minutesInput.value);
      if (!Number.isFinite(minutes) || minutes <= 0) {
        showExerciseError("请填写大于 0 的运动时长。", dom.minutesInput);
        return;
      }
      if (minutes > 1440) {
        showExerciseError("时长请填写 1440 分钟以内。", dom.minutesInput);
        return;
      }

      record = {
        id: createRecordId(),
        kind: selectedExercise,
        ts: getRecordTimestamp(dateKey),
        minutes: Math.round(minutes),
      };
    }

    const wasBackfill = dateKey !== currentDayKey;
    state.records.push(record);
    persist();
    clearExerciseInputs();
    exerciseDraftDateKey = currentDayKey;
    if (wasBackfill) setHistorySelection(dateKey);
    renderAll();
    showToast(
      wasBackfill
        ? `${EXERCISES[record.kind].label}已补记到 ${formatShortDate(
            dateKey
          )}（不计入今天）`
        : `${EXERCISES[record.kind].label}已记录`
    );
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  function clearExerciseInputs() {
    dom.runKmInput.value = "";
    dom.runMinutesInput.value = "";
    dom.minutesInput.value = "";
    dom.quickPickButtons.forEach((button) =>
      button.classList.remove("is-picked")
    );
    hideExerciseError();
  }

  function showExerciseError(message, input) {
    dom.exerciseError.textContent = message;
    dom.exerciseError.hidden = false;
    input?.focus();
  }

  function hideExerciseError() {
    dom.exerciseError.hidden = true;
    dom.exerciseError.textContent = "";
  }

  function removeRecord(id) {
    const index = state.records.findIndex((record) => record.id === id);
    if (index === -1) return;

    const [removed] = state.records.splice(index, 1);
    persist();
    renderAll();
    showToast(`已撤销一条${EXERCISES[removed.kind]?.label || "饮水"}记录`);

    if (removed.kind === "water") {
      dom.addWaterBtn.focus({ preventScroll: true });
    } else {
      dom.saveExerciseBtn.focus({ preventScroll: true });
    }
  }

  /* ---------- nickname ---------- */

  function openNicknameEditor() {
    dom.nicknameEditor.hidden = false;
    dom.editNicknameBtn.setAttribute("aria-expanded", "true");
    dom.nicknameInput.value = state.nickname;
    window.requestAnimationFrame(() => {
      dom.nicknameInput.focus();
      dom.nicknameInput.select();
    });
  }

  function closeNicknameEditor() {
    dom.nicknameEditor.hidden = true;
    dom.editNicknameBtn.setAttribute("aria-expanded", "false");
  }

  function saveNickname(event) {
    event.preventDefault();
    const value = limitText(
      dom.nicknameInput.value.trim().replace(/\s+/g, " "),
      NICKNAME_MAX_LENGTH
    );

    if (!value) {
      showToast("昵称不能为空");
      dom.nicknameInput.focus();
      return;
    }

    state.nickname = value;
    persist();
    dom.nicknameText.textContent = value;
    dom.nicknameText.title = value;
    closeNicknameEditor();
    dom.editNicknameBtn.focus();
    showToast("昵称已保存");
  }

  /* ---------- events ---------- */

  function bindEvents() {
    dom.addWaterBtn.addEventListener("click", addWater);
    dom.waterDateInput.addEventListener("change", () =>
      handleDraftDateChange("water")
    );
    dom.exerciseDateInput.addEventListener("change", () =>
      handleDraftDateChange("exercise")
    );
    dom.waterDateReset.addEventListener("click", () => resetDraftDate("water"));
    dom.exerciseDateReset.addEventListener("click", () =>
      resetDraftDate("exercise")
    );
    dom.prevMonthBtn.addEventListener("click", () => changeHistoryMonth(-1));
    dom.nextMonthBtn.addEventListener("click", () => changeHistoryMonth(1));
    dom.calendarTodayBtn.addEventListener("click", goToTodayHistory);
    dom.calendarGrid.addEventListener("click", (event) => {
      const dayButton = event.target.closest(".calendar-day");
      if (!dayButton || dayButton.disabled) return;
      selectHistoryDate(dayButton.dataset.date);
    });
    dom.exerciseForm.addEventListener("submit", submitExercise);
    dom.exerciseSwitch.addEventListener("click", (event) => {
      const tab = event.target.closest(".exercise-tab");
      if (!tab) return;
      selectExercise(tab.dataset.exercise);
    });
    dom.exerciseSwitch.addEventListener("keydown", handleTabKeys);

    dom.editNicknameBtn.addEventListener("click", () => {
      if (dom.nicknameEditor.hidden) {
        openNicknameEditor();
      } else {
        closeNicknameEditor();
      }
    });
    dom.nicknameEditor.addEventListener("submit", saveNickname);
    dom.cancelNicknameBtn.addEventListener("click", () => {
      closeNicknameEditor();
      dom.editNicknameBtn.focus();
    });
    dom.nicknameInput.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeNicknameEditor();
        dom.editNicknameBtn.focus();
      }
    });

    dom.quickPickButtons.forEach((button) => {
      button.addEventListener("click", () => {
        dom.minutesInput.value = button.dataset.minutes;
        hideExerciseError();
        dom.quickPickButtons.forEach((item) =>
          item.classList.toggle("is-picked", item === button)
        );
      });
    });

    dom.minutesInput.addEventListener("input", () => {
      hideExerciseError();
      const current = Number.parseFloat(dom.minutesInput.value);
      dom.quickPickButtons.forEach((button) =>
        button.classList.toggle(
          "is-picked",
          Number(button.dataset.minutes) === current
        )
      );
    });
    [dom.runKmInput, dom.runMinutesInput].forEach((input) =>
      input.addEventListener("input", hideExerciseError)
    );

    document.addEventListener("click", (event) => {
      const undo = event.target.closest("[data-remove-id]");
      if (!undo) return;
      removeRecord(undo.dataset.removeId);
    });
  }

  function handleTabKeys(event) {
    const currentIndex = EXERCISE_ORDER.indexOf(selectedExercise);
    let nextIndex = null;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % EXERCISE_ORDER.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex =
        (currentIndex - 1 + EXERCISE_ORDER.length) % EXERCISE_ORDER.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = EXERCISE_ORDER.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    selectExercise(EXERCISE_ORDER[nextIndex], { focus: true });
  }

  function handleStorageEvent(event) {
    if (event.key !== STORAGE_KEY) return;
    const previousDayKey = currentDayKey;
    currentDayKey = getDayKey(Date.now());
    if (waterDraftDateKey === previousDayKey) {
      waterDraftDateKey = currentDayKey;
    }
    if (exerciseDraftDateKey === previousDayKey) {
      exerciseDraftDateKey = currentDayKey;
    }
    if (selectedHistoryDate === previousDayKey) {
      setHistorySelection(currentDayKey);
    }
    state = loadState();
    selectedExercise = "run";
    renderAll();
  }

  /* ---------- time / utility ---------- */

  function getBeijingParts(input = Date.now()) {
    const date = input instanceof Date ? input : new Date(input);
    const shifted = new Date(date.getTime() + BEIJING_OFFSET_MS);
    return {
      year: shifted.getUTCFullYear(),
      month: shifted.getUTCMonth(),
      day: shifted.getUTCDate(),
      weekday: shifted.getUTCDay(),
      hours: shifted.getUTCHours(),
      minutes: shifted.getUTCMinutes(),
      seconds: shifted.getUTCSeconds(),
    };
  }

  function getDayKey(input = Date.now()) {
    const parts = getBeijingParts(input);
    return `${parts.year}-${pad2(parts.month + 1)}-${pad2(parts.day)}`;
  }

  function parseDayKeyTimestamp(dayKey) {
    return Date.parse(`${dayKey}T12:00:00+08:00`);
  }

  function isValidDayKey(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }

  function formatShortDate(dayKey) {
    const parts = getBeijingParts(parseDayKeyTimestamp(dayKey));
    const now = getBeijingParts(Date.now());
    if (parts.year !== now.year) {
      return `${parts.year}/${parts.month + 1}/${parts.day}`;
    }
    return `${parts.month + 1}月${parts.day}日`;
  }

  function updateDateChip() {
    const parts = getBeijingParts(Date.now());
    dom.todayChip.textContent = `${parts.month + 1}月${parts.day}日 ${
      WEEKDAYS[parts.weekday]
    }`;
    dom.todayChip.dateTime = `${parts.year}-${pad2(parts.month + 1)}-${pad2(
      parts.day
    )}`;
  }

  function checkDayRollover() {
    const previousDayKey = currentDayKey;
    const nextDayKey = getDayKey(Date.now());
    if (nextDayKey === currentDayKey) return;
    currentDayKey = nextDayKey;

    if (waterDraftDateKey === previousDayKey) {
      waterDraftDateKey = currentDayKey;
    }
    if (exerciseDraftDateKey === previousDayKey) {
      exerciseDraftDateKey = currentDayKey;
    }
    if (selectedHistoryDate === previousDayKey) {
      setHistorySelection(currentDayKey);
    }

    updateDateChip();
    renderAll();
    showToast("新的一天，今日记录已更新");
  }

  function formatTime(ts) {
    const parts = getBeijingParts(ts);
    return `${pad2(parts.hours)}:${pad2(parts.minutes)}`;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function createRecordId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `r-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function limitText(value, maxLength) {
    return Array.from(value).slice(0, maxLength).join("");
  }

  function shuffle(list) {
    const copy = [...list];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
    }
    return copy;
  }

  function showToast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, 1900);
  }
})();
