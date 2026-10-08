(function () {
  var Logic = window.MediationLogic;
  var Data = window.PrototypeData;
  var Storage = window.MediationStorage;
  var SpeechApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var speechBase = "";
  var speechGeneration = 0;

  function party() {
    return { rounds: [], draft: "", sampleIndex: 0, normalized: null, accepted: false };
  }

  function freshState() {
    return {
      phase: "collect",
      organizing: false,
      organizingText: "",
      parties: { A: party(), B: party() },
      advice: null,
      claimsOpen: false,
      referenceView: "cases",
      editing: null,
      editBuffer: "",
      listening: null,
      speechHint: "",
      scenarioId: scenarioId,
      reviewId: null,
      reviewStatus: "",
      reviewNote: "",
      adjustmentDraft: "",
      materials: null
    };
  }

  function currentScenario() {
    var list = Data.scenarios || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].id === state.scenarioId) return list[i];
    }
    return list[0];
  }

  function hasProgress() {
    var parties = state.parties;
    return state.phase !== "collect"
      || parties.A.rounds.length > 0
      || parties.B.rounds.length > 0
      || parties.A.draft.trim()
      || parties.B.draft.trim();
  }

  var scenarioId = "hallway";
  var state = freshState();
  var timer = 0;

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

  function bothAccepted() {
    return state.parties.A.accepted && state.parties.B.accepted;
  }

  function canFinish() {
    return state.parties.A.rounds.length > 0 && state.parties.B.rounds.length > 0;
  }

  function clock(ts) {
    var date = new Date(ts);
    function pad(number) { return String(number).padStart(2, "0"); }
    return pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
  }

  function stopListening() {
    speechGeneration += 1;
    state.listening = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try { recognition.abort(); } catch (error) {
      try { recognition.stop(); } catch (stopError) { /* already stopped */ }
    }
    recognition = null;
  }

  function speechErrorText(error) {
    if (error === "not-allowed") return "浏览器没有允许使用麦克风。请在地址栏允许后重试，或直接打字。";
    if (error === "audio-capture") return "没有找到可用的麦克风。请检查设备后重试，或直接打字。";
    if (error === "network" || error === "service-not-allowed") return "在线语音服务连不上。请用 Chrome 允许下载中文语音包后再试，或直接打字。";
    if (error === "language-not-supported") return "还没有中文语音包。请允许浏览器下载后，再点一次语音输入。";
    return "这次没有识别成功，请再试一次，或直接打字。";
  }

  function prepareLocalSpeech() {
    if (!SpeechApi || typeof SpeechApi.available !== "function" || typeof SpeechApi.install !== "function") {
      return Promise.resolve(false);
    }
    var options = { langs: ["zh-CN"], processLocally: true, quality: "dictation" };
    return SpeechApi.available(options).then(function (status) {
      if (status === "available") return true;
      if (status !== "downloadable" && status !== "downloading") return false;
      state.speechHint = "正在准备中文语音包，请在浏览器提示里允许下载。";
      render();
      return SpeechApi.install(options).then(function (ok) { return !!ok; });
    }).catch(function () { return false; });
  }

  function beginRecognition(side, local, generation) {
    if (generation !== speechGeneration || state.listening !== side || state.phase !== "collect") return;
    var person = state.parties[side];
    speechBase = person.draft || "";
    if (speechBase && !/\s$/.test(speechBase)) speechBase += "\n";
    recognition = new SpeechApi();
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    if (local) recognition.processLocally = true;
    var fatal = false;
    recognition.onresult = function (event) {
      var finalText = "";
      var interim = "";
      for (var i = 0; i < event.results.length; i += 1) {
        var piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += piece;
        else interim += piece;
      }
      person.draft = speechBase + finalText + interim;
      var box = document.querySelector('[data-draft="' + side + '"]');
      if (box && box.value !== person.draft) box.value = person.draft;
      var button = document.querySelector('[data-add="' + side + '"]');
      if (button) button.disabled = !person.draft.trim();
    };
    recognition.onerror = function (event) {
      if (generation !== speechGeneration) return;
      if (event.error === "aborted" || event.error === "no-speech") return;
      fatal = true;
      state.speechHint = speechErrorText(event.error);
      state.listening = null;
      recognition = null;
      render();
    };
    recognition.onend = function () {
      if (generation !== speechGeneration || fatal || state.listening !== side) return;
      speechBase = person.draft || "";
      if (speechBase && !/\s$/.test(speechBase)) speechBase += "\n";
      window.setTimeout(function () {
        if (generation !== speechGeneration || state.listening !== side || !recognition) return;
        try { recognition.start(); } catch (error) {
          state.speechHint = "语音识别已中断，请再点一次语音输入，或直接打字。";
          stopListening();
          render();
        }
      }, 250);
    };
    try {
      recognition.start();
      state.speechHint = "";
      render();
    } catch (error) {
      state.speechHint = speechErrorText("audio-capture");
      state.listening = null;
      recognition = null;
      render();
    }
  }

  function render() {
    syncReview();
    var app = document.getElementById("app");
    app.replaceChildren(renderHeader(), renderStage());
    if (state.editing) {
      var box = document.querySelector("[data-edit]");
      if (box) box.focus();
    }
  }

  function renderHeader() {
    var order = ["collect", "confirm", "advice"];
    var labels = { collect: "陈述诉求", confirm: "确认表述", advice: "调解建议" };
    var current = order.indexOf(state.phase);
    var steps = h("div", { class: "steps" });
    order.forEach(function (key, index) {
      if (index) steps.append(h("span", { class: "step-line" }));
      var cls = index < current ? "done" : index === current ? "current" : "";
      steps.append(h("div", { class: "step " + cls }, [
        h("i", { text: index < current ? "✓" : String(index + 1) }),
        labels[key]
      ]));
    });
    return h("header", { class: "topbar" }, [
      h("div", { class: "brand" }, [
        h("h1", { text: "义亭镇 · AI 智能调解" })
      ]),
      steps,
      h("div", { class: "top-actions" }, [
        h("div", { class: "example-switch", role: "tablist", "aria-label": "演示" }, [
          h("span", { class: "demo-tag", text: "演示" })
        ].concat((Data.scenarios || []).map(function (item) {
          var selected = item.id === state.scenarioId;
          return h("button", {
            type: "button",
            class: selected ? "solid" : "line",
            role: "tab",
            "aria-selected": selected ? "true" : "false",
            onclick: function () { switchScenario(item.id); },
            text: item.label
          });
        })))
      ])
    ]);
  }

  function renderStage() {
    var kids = [
      state.organizing ? h("div", { class: "banner", role: "status", text: state.organizingText }) : null,
      state.speechHint ? h("p", { class: "hint", text: state.speechHint }) : null
    ];
    if (state.phase === "advice" && (state.advice || state.reviewId)) {
      kids.push(renderClaimsBar());
      if (state.claimsOpen) kids.push(renderClaimsPreview());
      kids.push(state.advice ? renderAdvice() : renderPendingMaterials());
      return h("main", { class: "stage stage-advice" }, kids);
    }
    kids.push(
      h("section", { class: "columns" }, [renderParty("A"), renderParty("B")]),
      renderActionBar()
    );
    return h("main", { class: "stage" }, kids);
  }

  function syncReview() {
    if (!state.reviewId || state.advice) return;
    var record = Storage.get(state.reviewId);
    if (!record) return;
    state.reviewStatus = record.reviewStatus || "";
    state.reviewNote = record.reviewNote || "";
    if (record.reviewStatus === "approved") {
      state.advice = {
        suggestion: record.suggestion,
        suggestedAmount: record.suggestedAmount,
        headline: record.headline,
        laws: record.laws,
        cases: record.cases,
        caseNote: record.caseNote
      };
    }
  }

  function renderPendingMaterials() {
    var pack = state.materials || { laws: [], cases: [], caseNote: "" };
    return h("div", { class: "pending-stack" }, [
      renderReviewStrip(),
      h("section", { class: "advice-grid reference-only" }, [
        renderCaseColumn(pack.cases, pack.caseNote),
        renderLawColumn(pack.laws)
      ])
    ]);
  }

  function renderReviewStrip() {
    if (state.reviewStatus !== "returned") {
      return h("div", {
        class: "banner",
        role: "status",
        text: "调解建议审核中。认可前，本屏只展示相似案例和法律法规依据。"
      });
    }
    return h("div", { class: "banner pending-adjust", role: "status" }, [
      h("p", { text: "审核未认可。本屏与未审核时一致，只展示相似案例和法律法规依据。" }),
      h("p", { class: "review-note", text: "退回原因：" + (state.reviewNote || "未填写") }),
      h("label", { text: "需要调整的内容" }),
      h("textarea", {
        value: state.adjustmentDraft,
        placeholder: "请写明需要调整的内容。如需改金额，请写清调整后的金额。",
        oninput: function (event) { state.adjustmentDraft = event.target.value; }
      }),
      h("button", {
        type: "button",
        class: "solid",
        text: "重新生成并提交审核",
        disabled: state.organizing,
        onclick: regenerate
      })
    ]);
  }

  function renderCaseColumn(cases, note) {
    var body = h("article", { class: "panel" }, [
      h("p", { class: "kicker", text: "公开报道摘编" })
    ]);
    (cases || []).forEach(function (item) {
      body.append(h("div", { class: "case" }, [h("strong", { text: item.title }), item.text]));
    });
    if (note) body.append(h("p", { class: "note", text: note }));
    return h("div", { class: "advice-col" }, [
      h("h3", { class: "advice-title", text: "相似案例参考" }),
      body
    ]);
  }

  function renderLawColumn(laws) {
    var body = h("article", { class: "panel" });
    (laws || []).forEach(function (law) {
      body.append(h("div", { class: "law" }, [h("strong", { text: law.citation }), law.text]));
    });
    return h("div", { class: "advice-col" }, [
      h("h3", { class: "advice-title", text: "法律法规依据" }),
      body
    ]);
  }

  function renderClaimsBar() {
    return h("div", { class: "claims-bar" }, [
      h("button", {
        type: "button",
        class: "line",
        onclick: function () {
          state.claimsOpen = !state.claimsOpen;
          render();
        },
        text: state.claimsOpen ? "收起原始诉求" : "展开原始诉求"
      }),
      h("button", { type: "button", class: "line", onclick: reopen, text: "返回修改" })
    ]);
  }

  function renderClaimsPreview() {
    var row = h("section", { class: "claims-row" });
    ["A", "B"].forEach(function (side) {
      var person = state.parties[side];
      var details = h("details");
      details.append(h("summary", { text: "原始陈述（" + person.rounds.length + " 轮）" }));
      person.rounds.forEach(function (round, index) {
        details.append(h("article", { class: "round" }, [
          h("b", { text: "第 " + (index + 1) + " 轮 · " + clock(round.at) }),
          round.text
        ]));
      });
      row.append(h("div", { class: "advice-col" }, [
        h("h3", { class: "advice-title claim-label " + side.toLowerCase(), text: side === "A" ? "甲方" : "乙方" }),
        h("article", { class: "panel" }, [
          h("div", { class: "claim-text", text: person.normalized || "" }),
          details
        ])
      ]));
    });
    return row;
  }

  function renderParty(side) {
    var person = state.parties[side];
    var column = h("section", { class: "party " + side.toLowerCase() }, [
      h("div", { class: "party-head" }, [
        h("h2", { text: side === "A" ? "甲方" : "乙方" })
      ])
    ]);
    if (state.phase === "collect") column.append(renderCollect(side, person));
    else column.append(renderConfirm(side, person));
    return column;
  }

  function renderCollect(side, person) {
    var wrap = h("div", { class: "composer" });
    if (person.rounds.length) {
      var list = h("div", { class: "rounds" });
      person.rounds.forEach(function (round, index) {
        list.append(h("article", { class: "round" }, [
          h("b", { text: "第 " + (index + 1) + " 轮 · " + clock(round.at) }),
          round.text
        ]));
      });
      wrap.append(list);
    }
    var box = h("textarea", {
      "data-draft": side,
      value: person.draft,
      placeholder: "请输入您的诉求，建议按「事实经过；造成的损失；主张金额」的格式填写。",
      oninput: function (event) {
        person.draft = event.target.value;
        var button = document.querySelector('[data-add="' + side + '"]');
        if (button) button.disabled = !person.draft.trim();
      }
    });
    var sampleDone = person.sampleIndex >= currentScenario().samples[side].length;
    wrap.append(box, h("div", { class: "composer-actions" }, [
      h("button", {
        type: "button",
        class: "solid",
        "data-add": side,
        disabled: !person.draft.trim(),
        onclick: function () { addRound(side); },
        text: "添加本轮"
      }),
      h("button", {
        type: "button",
        class: "line",
        disabled: !SpeechApi,
        onclick: function () { toggleSpeech(side); },
        text: state.listening === side ? "停止" : "语音输入"
      }),
      h("button", {
        type: "button",
        class: "textish",
        disabled: sampleDone,
        onclick: function () { loadSample(side); },
        text: sampleDone ? "示例已全部载入" : "载入示例发言"
      })
    ]));
    if (!SpeechApi) wrap.append(h("p", { class: "hint", text: "请用 Chrome 打开后再语音输入。当前浏览器只能打字。" }));
    return wrap;
  }

  function renderConfirm(side, person) {
    var wrap = h("div", { class: "confirm-pane" });
    var details = h("details");
    details.append(h("summary", { text: "原始陈述（" + person.rounds.length + " 轮）" }));
    person.rounds.forEach(function (round, index) {
      details.append(h("article", { class: "round" }, [
        h("b", { text: "第 " + (index + 1) + " 轮 · " + clock(round.at) }),
        round.text
      ]));
    });
    wrap.append(details);
    if (state.organizing) return wrap;
    if (state.editing === side) {
      wrap.append(h("textarea", {
        "data-edit": side,
        value: state.editBuffer,
        oninput: function (event) { state.editBuffer = event.target.value; }
      }));
      wrap.append(h("div", { class: "card-actions" }, [
        h("button", { type: "button", class: "solid", onclick: function () { saveEdit(side); }, text: "保存" }),
        h("button", { type: "button", class: "line", onclick: cancelEdit, text: "取消" })
      ]));
      return wrap;
    }
    wrap.append(h("p", { class: "normalized", text: person.normalized || "" }));
    if (bothAccepted() || state.phase === "advice") {
      wrap.append(h("span", { class: "accepted-mark", text: "已认可" }));
      return wrap;
    }
    wrap.append(h("div", { class: "card-actions" }, [
      h("button", {
        type: "button",
        class: "solid",
        onclick: function () { toggleAccept(side); },
        text: person.accepted ? "取消认可" : "认可"
      }),
      h("button", { type: "button", class: "line", onclick: supplement, text: "继续补充" }),
      h("button", { type: "button", class: "line", onclick: function () { beginEdit(side); }, text: "手动修改" })
    ]));
    return wrap;
  }

  function renderActionBar() {
    var bar = h("div", { class: "action-bar" });
    if (state.phase === "collect") {
      bar.append(h("button", {
        type: "button",
        class: "solid",
        disabled: !canFinish() || state.organizing,
        onclick: finishTalk,
        text: "双方陈述结束"
      }));
      return bar;
    }
    if (state.organizing) return bar;
    if (!bothAccepted() && state.phase === "confirm") {
      bar.append(h("span", { class: "need", text: "本版诉求描述须经甲乙双方确认。双方均确认后，方可生成调解建议。" }));
      return bar;
    }
    if (state.phase === "confirm") {
      bar.append(
        h("button", { type: "button", class: "solid", onclick: generate, text: "生成调解建议" }),
        h("button", { type: "button", class: "line", onclick: reopen, text: "返回修改" })
      );
    }
    return bar;
  }

  function renderAdvice() {
    var advice = state.advice;
    var suggestion = h("div", { class: "advice-col" }, [
      h("h3", { class: "advice-title", text: "调解建议" }),
      h("article", { class: "panel" }, [
        h("p", { class: "kicker", text: "演示推算" }),
        h("p", { class: "figure", text: advice.headline || (advice.suggestedAmount == null ? "本次不报修复金" : "建议修复金 " + advice.suggestedAmount + "元") }),
        h("div", { class: "prose", text: advice.suggestion })
      ])
    ]);
    var showingCases = state.referenceView !== "laws";
    var referenceBody = h("article", { class: "panel" });
    if (showingCases) {
      referenceBody.append(h("p", { class: "kicker", text: "公开报道摘编" }));
      advice.cases.forEach(function (item) {
        referenceBody.append(h("div", { class: "case" }, [h("strong", { text: item.title }), item.text]));
      });
      referenceBody.append(h("p", { class: "note", text: advice.caseNote || "" }));
    } else {
      advice.laws.forEach(function (law) {
        referenceBody.append(h("div", { class: "law" }, [h("strong", { text: law.citation }), law.text]));
      });
    }
    var reference = h("div", { class: "advice-col" }, [
      h("div", { class: "advice-switch", role: "tablist" }, [
        h("button", {
          type: "button",
          role: "tab",
          "aria-selected": showingCases ? "true" : "false",
          onclick: function () {
            state.referenceView = "cases";
            render();
          },
          text: "相似案例参考"
        }),
        h("button", {
          type: "button",
          role: "tab",
          "aria-selected": showingCases ? "false" : "true",
          onclick: function () {
            state.referenceView = "laws";
            render();
          },
          text: "法律法规依据"
        })
      ]),
      referenceBody
    ]);
    return h("section", { class: "advice-grid" }, [suggestion, reference]);
  }

  function addRound(side) {
    var text = state.parties[side].draft.trim();
    if (!text) return;
    stopListening();
    state.parties[side].rounds.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text,
      at: Date.now()
    });
    state.parties[side].draft = "";
    render();
  }

  function loadSample(side) {
    var samples = currentScenario().samples[side];
    var index = state.parties[side].sampleIndex;
    if (index >= samples.length) return;
    stopListening();
    state.parties[side].draft = samples[index];
    state.parties[side].sampleIndex += 1;
    render();
  }

  function toggleSpeech(side) {
    if (!SpeechApi) return;
    if (state.listening === side) {
      stopListening();
      state.speechHint = "";
      render();
      return;
    }
    stopListening();
    var generation = speechGeneration;
    state.listening = side;
    state.speechHint = "正在准备语音";
    render();
    prepareLocalSpeech().then(function (local) {
      beginRecognition(side, local, generation);
    });
  }

  function finishTalk() {
    if (!canFinish() || state.organizing) return;
    stopListening();
    state.phase = "confirm";
    state.organizing = true;
    state.organizingText = "正在整理双方诉求";
    state.editing = null;
    render();
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      ["A", "B"].forEach(function (side) {
        state.parties[side].normalized = Logic.buildNormalized(side, state.parties[side].rounds);
        state.parties[side].accepted = false;
      });
      state.organizing = false;
      render();
    }, 800);
  }

  function toggleAccept(side) {
    if (bothAccepted()) return;
    state.parties[side].accepted = !state.parties[side].accepted;
    render();
  }

  function supplement() {
    stopListening();
    ["A", "B"].forEach(function (side) {
      state.parties[side].draft = "";
      state.parties[side].normalized = null;
      state.parties[side].accepted = false;
    });
    state.advice = null;
    state.phase = "collect";
    state.editing = null;
    render();
  }

  function beginEdit(side) {
    state.editing = side;
    state.editBuffer = state.parties[side].normalized || "";
    render();
  }

  function saveEdit(side) {
    state.parties[side].normalized = state.editBuffer;
    state.parties.A.accepted = false;
    state.parties.B.accepted = false;
    state.editing = null;
    render();
  }

  function cancelEdit() {
    state.editing = null;
    render();
  }

  function reopen() {
    if (state.reviewId && state.reviewStatus !== "approved" && state.reviewStatus !== "closed") {
      Storage.update(state.reviewId, {
        reviewStatus: "closed",
        reviewNote: "操作人员已返回修改，本次审核结束。"
      });
    }
    state.parties.A.accepted = false;
    state.parties.B.accepted = false;
    state.advice = null;
    clearRecordQuery();
    state.reviewId = null;
    state.reviewStatus = "";
    state.reviewNote = "";
    state.adjustmentDraft = "";
    state.materials = null;
    state.claimsOpen = false;
    state.phase = "confirm";
    state.editing = null;
    render();
  }

  function generate() {
    if (!bothAccepted() || state.organizing) return;
    state.organizing = true;
    state.organizingText = "正在生成调解建议";
    render();
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      var scenario = currentScenario();
      var left = state.parties.A.normalized;
      var right = state.parties.B.normalized;
      var result = scenario.advise === "hallway"
        ? Logic.buildHallwayAdvice(left, right)
        : Logic.buildAdvice(left, right);
      var needsReview = result.suggestedAmount != null;
      var recordId = "live-" + Date.now().toString(36);
      Storage.append({
        id: recordId,
        createdAt: new Date().toISOString(),
        caseTitle: scenario.caseTitle,
        partyA: { name: "甲方", normalized: left, amount: Logic.parseAmount(left) },
        partyB: { name: "乙方", normalized: right, amount: Logic.parseAmount(right) },
        suggestion: result.suggestion,
        suggestedAmount: result.suggestedAmount,
        headline: result.headline,
        laws: scenario.laws,
        cases: scenario.cases,
        caseNote: scenario.caseNote,
        reviewStatus: needsReview ? "pending" : "shown",
        reviewNote: "",
        adjustmentNote: ""
      });
      state.phase = "advice";
      state.claimsOpen = false;
      state.referenceView = "cases";
      state.organizing = false;
      if (needsReview) {
        state.advice = null;
        state.materials = {
          laws: scenario.laws,
          cases: scenario.cases,
          caseNote: scenario.caseNote
        };
        state.reviewId = recordId;
        state.reviewStatus = "pending";
        state.reviewNote = "";
        state.adjustmentDraft = "";
      } else {
        state.advice = {
          suggestion: result.suggestion,
          suggestedAmount: result.suggestedAmount,
          headline: result.headline,
          laws: scenario.laws,
          cases: scenario.cases,
          caseNote: scenario.caseNote
        };
        state.materials = null;
        state.reviewId = null;
        state.reviewStatus = "shown";
      }
      render();
    }, 800);
  }

  function regenerate() {
    var note = state.adjustmentDraft.trim();
    if (!note || !state.reviewId || state.organizing) return;
    var record = Storage.get(state.reviewId);
    if (!record) return;
    state.organizing = true;
    state.organizingText = "正在重新生成调解建议";
    render();
    window.clearTimeout(timer);
    timer = window.setTimeout(function () {
      var adjusted = Logic.applyAmountAdjustment(record, note);
      Storage.update(state.reviewId, {
        suggestion: adjusted.suggestion,
        suggestedAmount: adjusted.suggestedAmount,
        headline: adjusted.headline,
        adjustmentNote: note,
        reviewStatus: "pending",
        reviewNote: "",
        reviews: (record.reviews || []).concat([{ at: new Date().toISOString(), action: "adjust", note: note }])
      });
      state.adjustmentDraft = "";
      state.reviewStatus = "pending";
      state.reviewNote = "";
      state.advice = null;
      state.organizing = false;
      render();
    }, 800);
  }

  function switchScenario(id) {
    if (id === scenarioId) return;
    if (hasProgress() && !window.confirm("将清空本次演示并切换示例")) return;
    stopListening();
    window.clearTimeout(timer);
    clearRecordQuery();
    scenarioId = id;
    state = freshState();
    render();
  }

  function clearRecordQuery() {
    if (!window.history || !window.location.search) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }

  function scenarioIdForTitle(title) {
    var list = Data.scenarios || [];
    for (var i = 0; i < list.length; i += 1) {
      if (list[i].caseTitle === title) return list[i].id;
    }
    return "";
  }

  function showRecord(id) {
    var record = Storage.get(id);
    if (!record) return false;
    if (record.reviewStatus !== "approved" && record.reviewStatus !== "shown") return false;
    stopListening();
    window.clearTimeout(timer);
    var matched = scenarioIdForTitle(record.caseTitle);
    if (matched) scenarioId = matched;
    state = freshState();
    state.phase = "advice";
    state.parties.A.normalized = (record.partyA && record.partyA.normalized) || "";
    state.parties.B.normalized = (record.partyB && record.partyB.normalized) || "";
    state.parties.A.accepted = true;
    state.parties.B.accepted = true;
    state.advice = {
      suggestion: record.suggestion || "",
      suggestedAmount: record.suggestedAmount,
      headline: record.headline || (record.suggestedAmount == null ? "本次不涉及赔偿金额" : "建议修复金 " + record.suggestedAmount + "元"),
      laws: record.laws || [],
      cases: record.cases || [],
      caseNote: record.caseNote || ""
    };
    state.reviewId = record.id;
    state.reviewStatus = record.reviewStatus || "shown";
    state.referenceView = "cases";
    state.claimsOpen = false;
    render();
    return true;
  }

  function recordIdFromLocation() {
    try {
      return new URLSearchParams(window.location.search).get("record") || "";
    } catch (error) {
      return "";
    }
  }

  window.addEventListener("storage", function (event) {
    if (event.key === "yiting-screen-focus") {
      var focusId = "";
      try { focusId = JSON.parse(event.newValue || "{}").id || ""; } catch (error) { focusId = ""; }
      if (focusId) showRecord(focusId);
      return;
    }
    if (event.key !== Storage.key || !state.reviewId) return;
    render();
  });
  window.setInterval(function () {
    if (!state.reviewId || state.advice) return;
    var record = Storage.get(state.reviewId);
    if (!record) return;
    if (record.reviewStatus !== state.reviewStatus || record.reviewNote !== state.reviewNote) render();
  }, 1000);

  var openedId = recordIdFromLocation();
  if (!openedId || !showRecord(openedId)) render();
})();
