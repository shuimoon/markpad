(async () => {
  const rows = [...document.querySelectorAll('.setting-card button.setting-row')]
  const row = rows.find((item) => item.textContent.includes('导入文件'))
  row.click()
  await new Promise((r) => setTimeout(r, 150))
  const inputs = [...document.querySelectorAll('input[type="file"]')]
  const info = inputs.map((input) => ({
    accept: input.accept,
    multiple: input.multiple,
    hidden: input.style.display,
    inDom: document.body.contains(input),
  }))
  // simulate the user cancelling the system picker
  inputs.forEach((input) => input.dispatchEvent(new Event('cancel')))
  await new Promise((r) => setTimeout(r, 900))
  return {
    created: inputs.length,
    info,
    remaining: document.querySelectorAll('input[type="file"]').length,
    toast: document.querySelector('.toast')?.textContent || null,
  }
})()
