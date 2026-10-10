$content = Get-Content "..\pricing.html" -Raw
$old = @"
      btn.addEventListener("click", () => {
        const plan = DB.getPlan(btn.dataset.plan);
        const message =
          `مرحباً، أود تفعيل اشتراك "${plan.name}" لمتجري الخاص بي على منصتكم.\n\n` +
          `اسم المتجر: ${seller.name}\n` +
          `البريد الإلكتروني: ${seller.email}\n` +
          `السعر: ${money(plan.price)} شهرياً`;
        const link = Store.waLink(DB.PLATFORM_WHATSAPP, message);
        window.open(link, "_blank");
      });
"@
$new = @"
      btn.addEventListener("click", async () => {
        const plan = btn.dataset.plan;
        btn.disabled = true;
        btn.textContent = "جاري التحويل لصفحة الدفع...";
        try {
          const origin = window.location.origin;
          const res = await callCreateCheckoutSession({ plan, origin });
          const url = res?.data?.url;
          if (url) window.location.href = url;
          else throw new Error("لم يتم الحصول على رابط الدفع.");
        } catch (err) {
          alert("تعذّر إنشاء جلسة الدفع. تأكد من إعداد Stripe Cloud Functions.");
          console.error(err);
          btn.disabled = false;
          btn.textContent = "اشترك الآن — دفع آلي";
        }
      });
"@
if ($content -replace "`r`n", "`n" -match [regex]::Escape(($old -replace "`r`n", "`n"))) {
  $content = $content -replace [regex]::Escape(($old -replace "`r`n", "`n")), ($new -replace "`r`n", "`n")
  Set-Content -Path "..\pricing.html" -Value $content -NoNewline
  Write-Host "OK"
} else {
  Write-Host "NOT_FOUND"
}
