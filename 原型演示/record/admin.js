(function () {
  var Storage = window.MediationStorage;
  var ACCOUNT = { name: "admin", password: "yiting" };
  var openId = null;
  var loggedIn = sessionStorage.getItem("yiting-admin-session-record") === "1";
  var loginError = "";

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

  function render() {
    if (!loggedIn) {
      document.getElementById("app").replaceChildren(renderLogin());
      return;
    }
    var records = Storage.list().slice().sort(function (a, b) {
      return a.createdAt < b.createdAt ? 1 : -1;
    });
    var open = records.find(function (record) { return record.id === openId; }) || null;
    document.getElementById("app").replaceChildren(
      h("header", { class: "topbar" }, [
        h("div", { class: "brand" }, [
          h("h1", { text: "矛盾纠纷智能调解 · 管理后台" }),
          h("p", { text: "查看调解记录" })
        ]),
        h("button", { class: "line", type: "button", text: "退出", onclick: logout })
      ]),
      h("main", { class: "admin-wrap" }, [
        h("h2", { class: "history-title", text: "调解记录" }),
        renderTable(records),
        open ? renderDetail(open) : null
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
      sessionStorage.setItem("yiting-admin-session-record", "1");
      loggedIn = true;
      loginError = "";
      render();
      return;
    }
    loginError = "账号或密码不正确。";
    render();
  }

  function logout() {
    sessionStorage.removeItem("yiting-admin-session-record");
    loggedIn = false;
    openId = null;
    render();
  }

  function renderTable(records) {
    var body = h("tbody");
    if (!records.length) {
      body.append(h("tr", {}, [h("td", { colspan: "5", text: "还没有调解记录。" })]));
    }
    records.forEach(function (record) {
      var row = h("tr", {
        class: record.id === openId ? "open" : "",
        onclick: function () {
          openId = openId === record.id ? null : record.id;
          render();
        }
      }, [
        h("td", { text: Storage.formatTime(record.createdAt) }),
        h("td", { text: record.caseTitle }),
        h("td", { text: Storage.money(record.partyA.amount, "未明确") }),
        h("td", { text: Storage.money(record.partyB.amount, "未明确") }),
        h("td", { text: record.id === openId ? "收起" : "查看" })
      ]);
      body.append(row);
    });
    return h("div", { class: "table-wrap" }, [
      h("table", {}, [
        h("thead", {}, [
          h("tr", {}, ["时间", "案件", "申请人主张", "被申请人主张", ""].map(function (label) {
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
    return h("section", { class: "detail" }, [
      block("申请人", record.partyA.normalized),
      block("被申请人", record.partyB.normalized),
      block("调解建议", record.suggestion, true),
      block("法律法规依据", laws),
      block("相似案例参考", "公开报道摘编\n\n" + cases)
    ]);
  }

  window.addEventListener("storage", function (event) {
    if (!loggedIn || event.key !== Storage.key) return;
    render();
  });

  render();
})();
