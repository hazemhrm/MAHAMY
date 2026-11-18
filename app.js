(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const quotes = [
    "الإنجاز يبدأ بقرار صغير.",
    "لا تحتاج إلى إنجاز كل شيء اليوم؛ ابدأ بالأهم.",
    "الاستمرارية تصنع ما لا تصنعه السرعة.",
    "نظّم وقتك، واترك مساحة للأشياء الجميلة.",
    "كل خطوة واضحة تقرّبك من هدفك."
  ];

  function updateClock() {
    const now = new Date();
    const hour = now.getHours();
    const greeting = hour >= 5 && hour < 12 ? "صباح الخير 👋" : hour >= 12 && hour < 18 ? "مساء الخير 👋" : hour >= 18 && hour < 23 ? "مساء النور 👋" : "أهلاً بك 👋";
    $("#greeting").textContent = greeting;
    $("#liveClock").textContent = new Intl.DateTimeFormat("ar-EG", { hour: "2-digit", minute: "2-digit", hour12: true }).format(now);
    $("#fullDate").textContent = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
    $("#topbarDate").textContent = new Intl.DateTimeFormat("ar-EG", { weekday: "long", day: "numeric", month: "long" }).format(now);
  }

  function showPage(pageName) {
    const target = document.getElementById("page-" + pageName);
    if (!target) return;
    $$(".page").forEach((page) => page.classList.toggle("active", page === target));
    $$("[data-page]").forEach((button) => button.classList.toggle("active", button.dataset.page === pageName));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function bindNavigation() {
    $$("[data-page]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        showPage(element.dataset.page);
      });
    });
  }

  function loadDashboardData() {
    // Counts stay at zero until the real task module is added; no sample tasks are inserted.
    try {
      const raw = localStorage.getItem("mahamy_data_v1");
      const data = raw ? JSON.parse(raw) : {};
      const tasks = Array.isArray(data.tasks) ? data.tasks : [];
      const today = new Date().toISOString().slice(0, 10);
      const active = tasks.filter((task) => !task.completed);
      const completed = tasks.filter((task) => task.completed);
      const overdue = active.filter((task) => task.dueDate && task.dueDate < today);
      const todayTasks = tasks.filter((task) => task.date === today || task.dueDate === today);
      const todayDone = todayTasks.filter((task) => task.completed).length;
      const percent = todayTasks.length ? Math.round((todayDone / todayTasks.length) * 100) : 0;
      $("#totalTasks").textContent = String(tasks.length);
      $("#completedTasks").textContent = String(completed.length);
      $("#remainingTasks").textContent = String(active.length);
      $("#overdueTasks").textContent = String(overdue.length);
      $("#progressPercent").textContent = percent + "%";
      $("#progressBar").style.width = percent + "%";
      $("#progressCount").textContent = todayDone + " / " + todayTasks.length;
      $("#progressText").textContent = todayTasks.length ? "أحسنت، واصل تقدمك" : "لم تضف مهاماً لهذا اليوم بعد";
    } catch (error) {
      console.warn("تعذر قراءة بيانات مهامي المحفوظة:", error);
    }
  }

  function init() {
    updateClock();
    window.setInterval(updateClock, 1000);
    $("#dailyQuote").textContent = quotes[Math.floor(Math.random() * quotes.length)];
    bindNavigation();
    loadDashboardData();
    window.addEventListener("storage", (event) => {
      if (event.key === "mahamy_data_v1") loadDashboardData();
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();