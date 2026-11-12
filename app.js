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

  const EXERCISES = {
    run: {
      label: "跑步",
      emoji: "🏃",
      hint: "记录跑步的公里数和时长。",
      action: "记录跑步",
    },
    fitness: {
      label: "健身",
      emoji: "🏋️",
      hint: "记录健身时长，按分钟计算。",
      action: "记录健身",
    },
    stretch: {
      label: "拉伸",
      emoji: "🧘",
      hint: "记录拉伸时长，按分钟计算。",
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
    nicknameText: document.querySelector("#nicknameText"),
    editNicknameBtn: document.querySelector("#editNicknameBtn"),
    nicknameEditor: document.querySelector("#nicknameEditor"),
    nicknameInput: document.querySelector("#nicknameInput"),
    cancelNicknameBtn: document.querySelector("#cancelNicknameBtn"),

    waterTitle: document.querySelector("#waterTitle"),
    waterRingLabel: document.querySelector("#waterRingLabel"),
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
    waterRecordList: document.querySelector("#waterRecordList"),
    waterEmpty: document.querySelector("#waterEmpty"),
    waterEmptyText: document.querySelector("#waterEmptyText"),
    waterCount: document.querySelector("#waterCount"),

    exerciseTitle: document.querySelector("#exerciseTitle"),
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
    exerciseEmptyText: document.querySelector("#exerciseEmptyText"),
    exerciseCount: document.querySelector("#exerciseCount"),
    exerciseRecordsTitle: document.querySelector("#exerciseRecordsTitle"),
    selectedDateInput: document.querySelector("#selectedDateInput"),
    selectedDateHint: document.querySelector("#selectedDateHint"),
    selectedDateBadge: document.querySelector("#selectedDateBadge"),
    selectedDateScope: document.querySelector("#selectedDateScope"),
    prevDayBtn: document.querySelector("#prevDayBtn"),
    nextDayBtn: document.querySelector("#nextDayBtn"),
    dayTodayBtn: document.querySelector("#dayTodayBtn"),
    toast: document.querySelector("#toast"),
  };

  let selectedExercise = "run";
  let state = loadState();
  let currentDayKey = getDayKey(Date.now());
  let selectedDateKey = currentDayKey;
  let toastTimer = 0;
  let storageWarningShown = false;

  init();

  function init() {
    bindEvents();
    renderAll();
    persist({ silent: true });

    window.setInterval(checkDayRollover, 30000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
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

  function colorFor(kind) {
    return PALETTE_BY_KEY[state.colors[kind]] || PALETTE[0];
  }

  /* ---------- render ---------- */

  function renderAll() {
    renderIdentity();
    renderDayToolbar();
    renderWater();
    renderExercise();
    renderExerciseForm();
  }

  function renderIdentity() {
    dom.nicknameText.textContent = state.nickname;
    dom.nicknameText.title = state.nickname;
  }

  function renderWater() {
    const isToday = isSelectedDateToday();
    const records = recordsForDay(selectedDateKey)
      .filter((record) => record.kind === "water")
      .sort((a, b) => b.ts - a.ts);
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const ratio = Math.min(1, total / WATER_GOAL);
    const roundedPercent = Math.min(100, Math.round((total / WATER_GOAL) * 100));
    const percent = total < WATER_GOAL ? Math.min(99, roundedPercent) : 100;
    const remainingPercent = 100 - percent;
    const remainingMl = Math.max(0, WATER_GOAL - total);

    dom.waterTitle.textContent = isToday
      ? "今日饮水"
      : `${formatSelectedDateTitle()}饮水`;
    dom.waterRingLabel.textContent = isToday ? "今日已饮" : "当日已饮";
    dom.addWaterLabel.textContent = isToday ? "记录 250 ml" : "补记 250 ml";
    dom.waterEmptyText.textContent = isToday
      ? "还没有饮水记录，点上方按钮记下第一杯水吧。"
      : "这一天还没有饮水记录，点上方按钮补记一杯吧。";

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
      `${isToday ? "今日" : "当日"}已饮 ${total} 毫升，完成 ${percent}%，距离目标还差 ${remainingMl} 毫升`
    );

    dom.waterStatus.classList.toggle("is-done", total >= WATER_GOAL);
    dom.waterStatus.textContent =
      total === 0 ? "未开始" : total >= WATER_GOAL ? "已达标" : "进行中";

    if (total === 0) {
      dom.waterNote.textContent = isToday
        ? "第一杯水，等你来记录。"
        : "这一天还没有饮水记录。";
    } else if (total < WATER_GOAL) {
      dom.waterNote.textContent = `再喝 ${numberFormatter.format(
        remainingMl
      )} ml 就达成目标。`;
    } else if (total === WATER_GOAL) {
      dom.waterNote.textContent = isToday
        ? "目标达成，今天的水分补给刚刚好。"
        : "目标达成，这一天的水分补给刚刚好。";
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
    const isToday = isSelectedDateToday();
    const records = recordsForDay(selectedDateKey).filter(
      (record) => record.kind !== "water"
    );
    const totalMinutes = records.reduce(
      (sum, record) => sum + record.minutes,
      0
    );
    const recordedKinds = EXERCISE_ORDER.filter((kind) =>
      records.some((record) => record.kind === kind)
    );

    dom.exerciseTitle.textContent = isToday
      ? "今日运动"
      : `${formatSelectedDateTitle()}运动`;
    dom.exerciseRecordsTitle.textContent = isToday
      ? "今日已记录"
      : "当日已记录";
    dom.exerciseEmptyText.textContent = isToday
      ? "今天还没有运动记录，选一个项目开始吧。"
      : "这一天还没有运动记录，选一个项目补记吧。";
    dom.exerciseTotal.textContent = recordedKinds.length
      ? `${numberFormatter.format(totalMinutes)} 分钟`
      : "0 分钟";
    dom.exerciseCount.textContent = `${recordedKinds.length} 项`;
    dom.exerciseEmpty.hidden = recordedKinds.length > 0;
    dom.exerciseSummary.hidden = recordedKinds.length === 0;

    const groups = buildExerciseGroups(records, {
      subheading: isToday ? "今日合计" : "当日合计",
      ariaLabelPrefix: isToday ? "今日" : "当日",
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
    dom.saveExerciseLabel.textContent = isSelectedDateToday()
      ? info.action
      : `补记${info.label}`;
    dom.minuteFieldLabel.textContent = `${info.label}时长`;
    dom.minutesInput.placeholder = selectedExercise === "stretch" ? "如 10" : "如 30";
    hideExerciseError();
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

  /* ---------- selected date ---------- */

  function isSelectedDateToday() {
    return selectedDateKey === currentDayKey;
  }

  function getSelectedDateParts() {
    return getBeijingParts(parseDayKeyTimestamp(selectedDateKey));
  }

  function formatSelectedDateLabel() {
    const parts = getSelectedDateParts();
    const now = getBeijingParts(Date.now());
    const yearPrefix = parts.year === now.year ? "" : `${parts.year}年`;
    return `${yearPrefix}${parts.month + 1}月${parts.day}日 ${
      WEEKDAYS[parts.weekday]
    }`;
  }

  function formatSelectedDateTitle() {
    const parts = getSelectedDateParts();
    return `${parts.month + 1}月${parts.day}日`;
  }

  function renderDayToolbar() {
    const isToday = isSelectedDateToday();
    const now = getBeijingParts(Date.now());

    dom.selectedDateInput.max = currentDayKey;
    dom.selectedDateInput.value = selectedDateKey;
    dom.selectedDateHint.textContent = isToday
      ? `今天 · ${formatSelectedDateLabel()}`
      : formatSelectedDateLabel();
    dom.selectedDateBadge.textContent = isToday ? "今天" : "历史";
    dom.selectedDateBadge.classList.toggle("is-history", !isToday);
    dom.selectedDateScope.textContent = isToday
      ? "正在查看今天 · 下方内容均按北京时间"
      : "正在查看历史 · 下方内容均为这一天";
    dom.dayTodayBtn.hidden = isToday;
    dom.nextDayBtn.disabled = selectedDateKey >= currentDayKey;
    dom.prevDayBtn.disabled = selectedDateKey <= MIN_DATE_KEY;
  }

  function canSelectDate(dateKey) {
    return (
      isValidDayKey(dateKey) &&
      dateKey >= MIN_DATE_KEY &&
      dateKey <= currentDayKey
    );
  }

  function setSelectedDate(dateKey) {
    if (!canSelectDate(dateKey)) return;
    selectedDateKey = dateKey;
    renderAll();
  }

  function stepSelectedDate(delta) {
    const nextKey = shiftDayKey(selectedDateKey, delta);
    if (!canSelectDate(nextKey)) return;
    setSelectedDate(nextKey);
  }

  function handleSelectedDateChange() {
    const dateKey = dom.selectedDateInput.value;

    if (!dateKey) {
      dom.selectedDateInput.value = selectedDateKey;
      return;
    }

    if (!isValidDayKey(dateKey) || dateKey < MIN_DATE_KEY) {
      showToast("请选择有效的日期");
      dom.selectedDateInput.value = selectedDateKey;
      return;
    }

    if (dateKey > currentDayKey) {
      showToast("不能查看或记录未来日期");
      dom.selectedDateInput.value = selectedDateKey;
      return;
    }

    setSelectedDate(dateKey);
  }

  function shiftDayKey(dayKey, delta) {
    const [year, month, day] = dayKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day + delta));
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(
      date.getUTCDate()
    )}`;
  }

  function goToToday() {
    if (isSelectedDateToday()) return;
    setSelectedDate(currentDayKey);
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

  /* ---------- actions ---------- */

  function addWater() {
    checkDayRollover();
    const dateKey = selectedDateKey;
    const wasBackfill = dateKey !== currentDayKey;

    state.records.push({
      id: createRecordId(),
      kind: "water",
      amount: WATER_STEP,
      ts: getRecordTimestamp(dateKey),
    });
    persist();
    renderAll();
    bumpWaterTotal();
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

    const dateKey = selectedDateKey;
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
    dom.selectedDateInput.addEventListener("change", handleSelectedDateChange);
    dom.prevDayBtn.addEventListener("click", () => stepSelectedDate(-1));
    dom.nextDayBtn.addEventListener("click", () => stepSelectedDate(1));
    dom.dayTodayBtn.addEventListener("click", goToToday);
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
    if (selectedDateKey === previousDayKey) {
      selectedDateKey = currentDayKey;
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

  function checkDayRollover() {
    const previousDayKey = currentDayKey;
    const nextDayKey = getDayKey(Date.now());
    if (nextDayKey === currentDayKey) return;
    currentDayKey = nextDayKey;

    if (selectedDateKey === previousDayKey) {
      selectedDateKey = currentDayKey;
    }

    renderAll();
    showToast("新的一天，日期和今日记录已更新");
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
