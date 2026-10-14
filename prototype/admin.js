(function () {
  var Storage = window.MediationStorage;
  var ACCOUNT = { name: "admin", password: "yiting" };
  var openId = null;
  var loggedIn = sessionStorage.getItem("yiting-admin-session") === "1";
  var loginError = "";
  var returnId = null;
  var draftNote = "";
  var returnError = "";

  function h(tag, props, kids) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key === "text") node.textContent = value;
      else if (key.indexOf("on") === 0 && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else if ((tag === "textarea" || tag === "input") && key === "value") node.value = value;
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    (kids || []).forEach(function (kid) {
      if (kid == null || kid === false) return;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    });
    return node;
  }

  function reviewLabel(record) {
    if (record.reviewStatus === "pending") return "待审核";
    if (record.reviewStatus === "returned") return "待调整";
    if (record.reviewStatus === "approved") return "已认可";
    if (record.reviewStatus === "closed") return "已撤回";
    if (record.reviewStatus === "shown") return "无需审核";
    return "无需审核";
  }

  function reviewRank(record) {
    if (record.reviewStatus === "pending") return 0;
    if (record.reviewStatus === "returned") return 1;
    return 2;
  }

  function render() {
    if (!loggedIn) {
      document.getElementById("app").replaceChildren(renderLogin());
      return;
    }
    var records = Storage.list().slice().sort(function (a, b) {
      var rank = reviewRank(a) - reviewRank(b);
      if (rank) return rank;
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    var open = records.find(function (record) { return record.id === openId; }) || null;
    document.getElementById("app").replaceChildren(
      h("header", { class: "topbar" }, [
        h("div", { class: "brand" }, [
          h("h1", { text: "矛盾纠纷智能调解 · 管理后台" }),
          h("p", { text: "审核涉及赔偿金额的调解建议" })
        ]),
        h("button", { class: "line", type: "button", text: "退出", onclick: logout })
      ]),
      h("main", { class: "admin-wrap" }, [
        renderQueue(records.filter(function (record) {
          return record.reviewStatus === "pending" || record.reviewStatus === "returned";
        })),
        h("h2", { class: "history-title", text: "历史记录" }),
        renderTable(records.filter(function (record) {
          return record.reviewStatus !== "pending" && record.reviewStatus !== "returned";
        })),
        open && open.reviewStatus !== "pending" && open.reviewStatus !== "returned" ? renderDetail(open) : null
      ])
    );
  }

  function renderLogin() {
    return h("main", { class: "login-wrap" }, [
      h("form", { class: "login-card", onsubmit: submitLogin }, [
        h("h1", { text: "管理后台" }),
        h("p", { class: "need", text: "演示账户：admin，密码：yiting。" }),
        h("label", { text: "账号" }),
        h("input", { name: "account", value: ACCOUNT.name, autocomplete: "username" }),
        h("label", { text: "密码" }),
        h("input", { name: "password", type: "password", value: ACCOUNT.password, autocomplete: "current-password" }),
        loginError ? h("p", { class: "hint", text: loginError }) : null,
        h("button", { class: "solid", type: "submit", text: "进入" })
      ])
    ]);
  }

  function submitLogin(event) {
    event.preventDefault();
    var name = event.target.elements.account.value.trim();
    var password = event.target.elements.password.value;
    if (name === ACCOUNT.name && password === ACCOUNT.password) {
      sessionStorage.setItem("yiting-admin-session", "1");
      loggedIn = true;
      loginError = "";
      render();
      return;
    }
    loginError = "账号或密码不正确。";
    render();
  }

  function logout() {
    sessionStorage.removeItem("yiting-admin-session");
    loggedIn = false;
    openId = null;
    returnId = null;
    draftNote = "";
    returnError = "";
    render();
  }

  function renderQueue(records) {
    var box = h("section", { class: "queue" }, [
      h("h2", { text: "待审核" })
    ]);
    if (!records.length) {
      box.append(h("p", { class: "queue-empty", text: "当前没有待审核的调解建议。大屏生成涉及赔偿金额的建议后，会出现在这里。" }));
      return box;
    }
    records.forEach(function (record) {
      var card = h("article", { class: "queue-card" }, [
        h("div", { class: "queue-head" }, [
          h("div", {}, [
            h("h3", { text: record.caseTitle || "调解建议" }),
            h("p", { class: "need", text: Storage.formatTime(record.createdAt) + " · " + reviewLabel(record) })
          ]),
          h("p", { class: "queue-amount", text: Storage.money(record.suggestedAmount, "本次不报赔偿金额") })
        ]),
        h("div", { class: "prose queue-suggestion", text: record.suggestion || "" })
      ]);
      if (record.reviewNote) card.append(h("p", { class: "review-note", text: "退回原因：" + record.reviewNote }));
      if (record.adjustmentNote) card.append(h("p", { class: "need", text: "操作人员调整：" + record.adjustmentNote }));
      card.append(renderActions(record));
      box.append(card);
    });
    return box;
  }

  function renderTable(records) {
    var body = h("tbody");
    if (!records.length) {
      body.append(h("tr", {}, [h("td", { colspan: "7", text: "还没有调解记录。" })]));
    }
    records.forEach(function (record) {
      var row = h("tr", {
        class: record.id === openId ? "open" : "",
        onclick: function () {
          openId = openId === record.id ? null : record.id;
          returnId = null;
          draftNote = "";
          returnError = "";
          render();
        }
      }, [
        h("td", { text: Storage.formatTime(record.createdAt) }),
        h("td", { text: record.caseTitle }),
        h("td", { text: Storage.money(record.partyA.amount, "未明确") }),
        h("td", { text: Storage.money(record.partyB.amount, "未明确") }),
        h("td", { text: Storage.money(record.suggestedAmount, "未形成") }),
        h("td", { class: "status-" + (record.reviewStatus || "filed"), text: reviewLabel(record) }),
        h("td", { text: record.id === openId ? "收起" : "查看" })
      ]);
      body.append(row);
    });
    return h("div", { class: "table-wrap" }, [
      h("table", {}, [
        h("thead", {}, [
          h("tr", {}, ["时间", "案件", "申请人主张", "被申请人主张", "建议金额", "审核", ""].map(function (label) {
            return h("th", { text: label });
          }))
        ]),
        body
      ])
    ]);
  }

  function block(title, text, wide) {
    return h("article", { class: wide ? "wide" : "" }, [
      h("h3", { text: title }),
      h("div", { class: "prose", text: text || "" })
    ]);
  }

  function renderDetail(record) {
    var laws = (record.laws || []).map(function (law) {
      return law.citation + "\n" + law.text;
    }).join("\n\n");
    var cases = (record.cases || []).map(function (item) {
      return item.title + "\n" + item.text;
    }).join("\n\n");
    if (record.caseNote) cases += (cases ? "\n\n" : "") + record.caseNote;
    var notes = [];
    if (record.reviewNote) notes.push("退回原因：" + record.reviewNote);
    if (record.adjustmentNote) notes.push("操作人员调整：" + record.adjustmentNote);
    return h("section", { class: "detail" }, [
      block("申请人", record.partyA.normalized),
      block("被申请人", record.partyB.normalized),
      block("调解建议", record.suggestion, true),
      notes.length ? block("审核往来", notes.join("\n\n"), true) : null,
      block("法律法规依据", laws),
      block("相似案例参考", "公开报道摘编\n\n" + cases),
      renderActions(record)
    ]);
  }

  function renderActions(record) {
    if (String(record.id).indexOf("seed-") === 0) return null;
    if (record.reviewStatus === "returned") {
      return h("p", { class: "need wide", text: "已退回操作人员。对方写明调整内容并重新生成后，本条会再次变为待审核。" });
    }
    if (record.reviewStatus !== "pending") return null;
    var actions = h("div", { class: "review-actions wide" }, [
      h("button", { type: "button", class: "solid", text: "认可", onclick: function () { approve(record.id); } }),
      h("button", {
        type: "button",
        class: "line",
        text: returnId === record.id ? "取消退回" : "退回调整",
        onclick: function () {
          returnId = returnId === record.id ? null : record.id;
          returnError = "";
          render();
        }
      })
    ]);
    if (returnId !== record.id) return actions;
    return h("div", { class: "wide" }, [
      actions,
      h("label", { class: "need", text: "金额不合适的原因" }),
      h("textarea", {
        value: draftNote,
        oninput: function (event) { draftNote = event.target.value; }
      }),
      returnError ? h("p", { class: "hint", text: returnError }) : null,
      h("button", { type: "button", class: "solid", text: "确认退回", onclick: function () { returnReview(record.id); } })
    ]);
  }

  function approve(id) {
    var record = Storage.get(id);
    if (!record || record.reviewStatus !== "pending") return;
    var saved = Storage.update(id, {
      reviewStatus: "approved",
      reviews: (record.reviews || []).concat([{ at: new Date().toISOString(), action: "approve", note: "认可建议金额" }])
    });
    if (!saved) return;
    returnId = null;
    try {
      localStorage.setItem("yiting-screen-focus", JSON.stringify({ id: id, at: Date.now() }));
    } catch (error) { /* 大屏未打开时仍由本页跳转 */ }
    window.location.href = "index.html?record=" + encodeURIComponent(id);
  }

  function returnReview(id) {
    var note = draftNote.trim();
    if (!note) {
      returnError = "请写明金额不合适的原因。";
      render();
      return;
    }
    var record = Storage.get(id);
    if (!record || record.reviewStatus !== "pending") return;
    Storage.update(id, {
      reviewStatus: "returned",
      reviewNote: note,
      reviews: (record.reviews || []).concat([{ at: new Date().toISOString(), action: "return", note: note }])
    });
    draftNote = "";
    returnId = null;
    returnError = "";
    render();
  }

  window.addEventListener("storage", function (event) {
    if (!loggedIn || event.key !== Storage.key) return;
    render();
  });

  render();
})();
