/* أخصائي التحليل المتميز — Supabase */
const SUPABASE_URL = "https://zugascrugkhcapyjzbpx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_d8xM5Oyk9CscoqQ70twwhA_Ufus9sAb";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

document.getElementById("year").textContent = new Date().getFullYear();

const courseGrid = document.getElementById("courseGrid");
const authArea = document.getElementById("authArea");
const authModal = document.getElementById("authModal");
const courseModal = document.getElementById("courseModal");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubmit = document.getElementById("authSubmit");
const toggleAuth = document.getElementById("toggleAuth");
const authMessage = document.getElementById("authMessage");
const nameField = document.getElementById("nameField");
const phoneField = document.getElementById("phoneField");
const courseDetails = document.getElementById("courseDetails");

let authMode = "login";
let currentUser = null;

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toLocaleString("ar-EG")} ج.م` : "السعر غير محدد";
}

function openModal(el) { el?.classList.remove("hidden"); }
function closeModal(el) { el?.classList.add("hidden"); }

document.querySelectorAll("[data-close]").forEach(btn => {
  btn.addEventListener("click", () => closeModal(document.getElementById(btn.dataset.close)));
});

[authModal, courseModal].forEach(modal => {
  modal?.addEventListener("click", e => {
    if (e.target === modal) closeModal(modal);
  });
});

document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener("click", e => {
    const id = link.getAttribute("href");
    const target = id && id.length > 1 ? document.querySelector(id) : null;
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior:"smooth", block:"start" });
    }
  });
});

function setAuthMode(mode) {
  authMode = mode;
  const signup = mode === "signup";
  authTitle.textContent = signup ? "إنشاء حساب جديد" : "تسجيل الدخول";
  authSubmit.textContent = signup ? "إنشاء الحساب" : "دخول";
  toggleAuth.textContent = signup ? "لدي حساب بالفعل" : "إنشاء حساب جديد";
  nameField.classList.toggle("hidden", !signup);
  phoneField.classList.toggle("hidden", !signup);
  authMessage.textContent = "";
}

toggleAuth.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "signup" : "login");
});

document.addEventListener("click", e => {
  const authButton = e.target.closest('[data-auth="login"]');
  if (authButton) {
    if (currentUser) logout();
    else {
      setAuthMode("login");
      openModal(authModal);
    }
  }

  const courseButton = e.target.closest("[data-course-id]");
  if (courseButton) openCourseDetails(courseButton.dataset.courseId);
});

authForm.addEventListener("submit", async e => {
  e.preventDefault();
  authSubmit.disabled = true;
  authMessage.textContent = "جارٍ التنفيذ...";

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const name = document.getElementById("authName").value.trim();
  const phone = document.getElementById("authPhone").value.trim();

  try {
    if (authMode === "login") {
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      authMessage.textContent = "تم تسجيل الدخول بنجاح.";
      setTimeout(() => closeModal(authModal), 500);
    } else {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { full_name:name, phone } }
      });
      if (error) throw error;
      if (data.user) await ensureProfile(data.user, name, phone);
      authMessage.textContent =
        "تم إنشاء الحساب. إذا كان تأكيد البريد مفعّلًا، راجع بريدك الإلكتروني.";
    }
  } catch (err) {
    console.error(err);
    authMessage.textContent = translateError(err);
  } finally {
    authSubmit.disabled = false;
  }
});

async function ensureProfile(user, fullName = "", phone = "") {
  const { error } = await supabaseClient.from("profiles").upsert({
    id: user.id,
    full_name: fullName || user.user_metadata?.full_name || "",
    phone: phone || user.user_metadata?.phone || "",
    role: "student"
  }, { onConflict:"id" });

  if (error) console.warn("Profile:", error.message);
}

function translateError(err) {
  const m = err?.message || "حدث خطأ غير متوقع.";
  if (/invalid login credentials/i.test(m)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
  if (/user already registered/i.test(m)) return "هذا البريد مسجل بالفعل.";
  return m;
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error(error);
}

function renderAuthArea() {
  if (!authArea) return;
  if (!currentUser) {
    authArea.innerHTML = '<button class="btn btn-primary btn-small" data-auth="login">تسجيل الدخول</button>';
  } else {
    authArea.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:12px;color:#cbd3df;max-width:180px;overflow:hidden;text-overflow:ellipsis">
          ${escapeHTML(currentUser.email || "")}
        </span>
        <button class="btn btn-outline btn-small" data-auth="login">خروج</button>
      </div>`;
  }
}

async function loadCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error) console.warn(error.message);
  currentUser = data?.user || null;
  renderAuthArea();
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
  currentUser = session?.user || null;
  renderAuthArea();
});

async function loadCourses() {
  courseGrid.innerHTML = '<div class="loading-card">جاري تحميل الكورسات...</div>';

  const { data, error } = await supabaseClient
    .from("courses")
    .select("id,title,description,price,thumbnail_url,is_published,created_at")
    .eq("is_published", true)
    .order("created_at", { ascending:false });

  if (error) {
    console.error(error);
    courseGrid.innerHTML =
      '<div class="empty-card">تعذر تحميل الكورسات حاليًا. تأكد من RLS وسياسة القراءة لجدول courses.</div>';
    return;
  }

  if (!data?.length) {
    courseGrid.innerHTML = '<div class="empty-card">لا توجد كورسات منشورة حاليًا.</div>';
    return;
  }

  courseGrid.innerHTML = data.map((course, i) => `
    <article class="course-card">
      <div class="course-cover ${i % 2 ? "cover-two" : "cover-one"}"
        ${course.thumbnail_url
          ? `style="background-image:url('${escapeHTML(course.thumbnail_url)}');background-size:cover;background-position:center"`
          : ""}>
        <span>COURSE ${String(i + 1).padStart(2,"0")}</span>
      </div>
      <div class="course-body">
        <span class="tag">${i === 0 ? "الأكثر طلبًا" : "متاح الآن"}</span>
        <h3>${escapeHTML(course.title)}</h3>
        <p>${escapeHTML(course.description || "كورس تعليمي متخصص.")}</p>
        <div class="course-meta"><span>🎓 كورس عملي</span><span>📄 ملفات مرفقة</span></div>
        <div class="price-row">
          <strong>${formatPrice(course.price)}</strong>
          <button class="btn btn-primary btn-small" data-course-id="${course.id}">اعرف التفاصيل</button>
        </div>
      </div>
    </article>
  `).join("");
}

async function openCourseDetails(courseId) {
  courseDetails.innerHTML = "<p>جاري تحميل التفاصيل...</p>";
  openModal(courseModal);

  const { data:course, error } = await supabaseClient
    .from("courses")
    .select("id,title,description,price,thumbnail_url")
    .eq("id", courseId)
    .eq("is_published", true)
    .single();

  if (error) {
    courseDetails.innerHTML = "<p>تعذر تحميل تفاصيل الكورس.</p>";
    return;
  }

  const { data:lessons } = await supabaseClient
    .from("lessons")
    .select("id,title,description,lesson_order")
    .eq("course_id", courseId)
    .eq("is_published", true)
    .order("lesson_order", { ascending:true });

  const enrolled = currentUser ? await checkEnrollment(currentUser.id, courseId) : false;

  courseDetails.innerHTML = `
    <div class="detail-cover"
      ${course.thumbnail_url
        ? `style="background-image:url('${escapeHTML(course.thumbnail_url)}');background-size:cover;background-position:center"`
        : ""}>
      <h2>${escapeHTML(course.title)}</h2>
    </div>
    <div style="padding-top:20px">
      <div class="detail-meta">
        <span>💰 ${formatPrice(course.price)}</span>
        <span>🎓 ${lessons?.length || 0} درس</span>
      </div>
      <p>${escapeHTML(course.description || "")}</p>
      <div class="lesson-list">
        <h3>محتوى الكورس</h3>
        ${(lessons?.length
          ? lessons.map((lesson,i) => `
            <div class="lesson-item">
              <strong>${i+1}. ${escapeHTML(lesson.title)}</strong>
              ${lesson.description ? `<div>${escapeHTML(lesson.description)}</div>` : ""}
              <small>${enrolled ? "متاح لك بعد التفعيل." : "يتاح بعد تفعيل الاشتراك."}</small>
            </div>`).join("")
          : "<p>سيتم إضافة الدروس قريبًا.</p>")}
      </div>
      <button class="btn btn-primary full" id="buyCourseButton">
        ${enrolled ? "الكورس مفعّل بالفعل" : "بدء إجراءات الشراء"}
      </button>
      <p id="purchaseMessage" class="form-message"></p>
    </div>`;

  document.getElementById("buyCourseButton").addEventListener("click", () => startPurchase(course));
}

async function checkEnrollment(userId, courseId) {
  const { data, error } = await supabaseClient
    .from("enrollments")
    .select("id,status")
    .eq("user_id", userId)
    .eq("course_id", courseId)
    .in("status", ["active","approved","completed"])
    .maybeSingle();

  if (error) console.warn("Enrollment:", error.message);
  return !!data;
}

async function startPurchase(course) {
  const message = document.getElementById("purchaseMessage");

  if (!currentUser) {
    closeModal(courseModal);
    openModal(authModal);
    message && (message.textContent = "سجّل الدخول أولًا.");
    return;
  }

  message.textContent =
    "الخطوة التالية هي إضافة بيانات InstaPay والمحفظة ونموذج إثبات التحويل، ثم إرسال العملية إلى جدول payments بحالة pending.";
}

async function init() {
  await loadCurrentUser();
  await loadCourses();
}

init();
