(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof root !== "undefined") root.MediationLogic = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  var AMOUNT_RE = /(\d+(?:\.\d+)?)\s*万元|(\d+(?:\.\d+)?)\s*万(?!元)|(\d+(?:\.\d+)?)\s*元/g;
  var REQUEST_RE = /要求|主张|希望|愿意|接受|赔偿|赔|修复|重做/;
  var WALL_RE = /墙面|墙体|涂料/;
  var CEIL_RE = /吊顶|天花板/;

  function parseAmount(text) {
    if (!text) return null;
    AMOUNT_RE.lastIndex = 0;
    var last = null;
    var match;
    while ((match = AMOUNT_RE.exec(text))) {
      if (match[1] != null) last = Math.round(parseFloat(match[1]) * 10000);
      else if (match[2] != null) last = Math.round(parseFloat(match[2]) * 10000);
      else last = Math.round(parseFloat(match[3]));
    }
    return last;
  }

  function amountLabel(amount) {
    return amount == null ? "未明确" : amount + "元";
  }

  function partyTitle(side) {
    return side === "A" ? "甲方" : "乙方";
  }

  function requestLines(rounds) {
    var lines = [];
    rounds.forEach(function (round) {
      String(round).split(/[。！？\n]+/).forEach(function (part) {
        var sentence = part.trim();
        if (sentence && REQUEST_RE.test(sentence)) lines.push(sentence);
      });
    });
    return lines;
  }

  function buildNormalized(side, rounds) {
    var texts = (rounds || []).map(function (round) {
      return String(round && round.text != null ? round.text : round).trim();
    }).filter(Boolean);
    var facts = texts.map(function (text, index) {
      return (index + 1) + ". " + text;
    }).join("\n");
    var amount = parseAmount(texts.join("\n"));
    var requests = requestLines(texts);
    return [
      partyTitle(side) + "的诉求如下。",
      "",
      "事实经过：",
      facts,
      "",
      "主张金额：" + amountLabel(amount) + "。",
      "",
      "请求事项：",
      requests.length ? requests.join("\n") : "见上述事实经过。"
    ].join("\n");
  }

  function detectScope(text) {
    var wall = WALL_RE.test(text);
    var ceiling = CEIL_RE.test(text);
    var surface = wall || ceiling;
    if (/卧室/.test(text) && /卫生间/.test(text) && surface) {
      return {
        tier: "多房间受损",
        amount: 15000,
        scopeText: "卧室与卫生间等多处受损",
        anchor: "15000元用于卧室与卫生间等多处受损，靠近上海案件中卧室加卫生间的鉴定修复造价19233元，不把鉴定费算进修复金。"
      };
    }
    if (wall && ceiling) {
      return {
        tier: "墙面加吊顶",
        amount: 10000,
        scopeText: "墙面、吊顶",
        anchor: "10000元用于墙面和吊顶都要恢复的情形，高于单处修复，低于上海案件里卧室加卫生间的鉴定修复造价19233元。"
      };
    }
    if (wall || ceiling) {
      return {
        tier: "单一饰面",
        amount: 6000,
        scopeText: wall && !ceiling ? "墙面" : "吊顶",
        anchor: "6000元高于富顺调解中4000元的自行修复，用于含人工的单处饰面。"
      };
    }
    return {
      tier: null,
      amount: null,
      scopeText: "受损部位尚未具体到墙面、吊顶或多个房间",
      anchor: ""
    };
  }

  function mentionedFees(text) {
    var items = [];
    if (/修复|重做|恢复/.test(text)) items.push("修复");
    if (/家具|柜子|家电/.test(text)) items.push("家具或柜子");
    if (/误工/.test(text)) items.push("误工");
    if (!items.length) return "陈述未提及修复、家具或柜子、误工。";
    return "陈述提及" + items.join("、") + "。";
  }

  function sideGap(name, claim, suggested) {
    if (claim == null || suggested == null) return "";
    if (claim > suggested) return name + "主张" + claim + "元，高于建议修复金，高出部分不自动计入。";
    if (claim < suggested) return name + "主张" + claim + "元，低于这一档修复费用。";
    return name + "主张" + claim + "元，与建议修复金一致。";
  }

  function buildAdvice(textA, textB) {
    var left = textA || "";
    var right = textB || "";
    var combined = left + "\n" + right;
    var amountA = parseAmount(left);
    var amountB = parseAmount(right);
    var scope = detectScope(combined);
    var furniture = /家具|柜子|家电/.test(combined);
    var wage = /误工/.test(combined);
    var lines = [];

    var admitted = [];
    if (/承认/.test(left)) admitted.push("甲方");
    if (/承认/.test(right)) admitted.push("乙方");
    lines.push("争议焦点");
    lines.push("漏水原因：" + (admitted.length
      ? admitted.join("、") + "已承认漏水。"
      : "尚未有一方明确承认漏水，建议先共同确认漏水点。"));
    lines.push("损害范围：" + scope.scopeText + "。");
    lines.push("费用项目：甲方主张" + amountLabel(amountA) + "，乙方主张" + amountLabel(amountB) + "。" + mentionedFees(combined));
    lines.push("");
    lines.push("责任与履行");
    lines.push("1. 双方于3日内共同查看并确认漏水点。");
    lines.push("2. 漏水源头所在一方于15日内重做防水。这是行为义务，不折进修复金。");
    lines.push("3. 受损一方配合进场，移开靠墙物品。防水完成并干燥后，再恢复受损饰面。");
    lines.push("4. 双方验收合格后，再支付下面确定的修复金。");
    lines.push("");
    lines.push("分项处理");
    if (scope.amount == null) {
      lines.push("饰面修复：请补清受损的是墙面、吊顶，还是卧室与卫生间等多处，本次先不报修复金。");
    } else {
      lines.push("饰面修复：" + scope.tier + "，建议修复金" + scope.amount + "元。");
    }
    lines.push(furniture
      ? "家具、柜子：不按购买原价计入本次修复金，按损失发生时的市场价格另议。"
      : "家具、柜子：双方陈述未提及家具损失，本次不列。");
    lines.push(wage
      ? "误工：本次不计入建议金额，如需主张，另行提供依据。"
      : "误工：双方陈述未提及误工，本次不列。");
    lines.push("");
    lines.push("金额如何确定");
    if (amountA != null && amountB != null) {
      lines.push("甲方主张" + amountA + "元，乙方主张" + amountB + "元，差额" + Math.abs(amountA - amountB) + "元。");
    } else if (amountA != null) {
      lines.push("甲方主张" + amountA + "元，乙方主张未明确。");
    } else if (amountB != null) {
      lines.push("甲方主张未明确，乙方主张" + amountB + "元。");
    }
    if (scope.amount == null) {
      lines.push("受损部位不足，本次不报修复金，也不取双方主张的平均数。");
    } else {
      lines.push(scope.anchor);
      lines.push("建议修复金" + scope.amount + "元。建议修复金按受损范围档次确定，不是双方主张的平均数。");
      [sideGap("甲方", amountA, scope.amount), sideGap("乙方", amountB, scope.amount)].forEach(function (line) {
        if (line) lines.push(line);
      });
    }

    return {
      suggestion: lines.join("\n"),
      suggestedAmount: scope.amount,
      headline: scope.amount == null ? "本次不报修复金" : "建议修复金 " + scope.amount + "元"
    };
  }

  function buildHallwayAdvice(textA, textB) {
    var left = textA || "";
    var right = textB || "";
    var admitted = [];
    if (/承认/.test(left)) admitted.push("甲方");
    if (/承认/.test(right)) admitted.push("乙方");
    var lines = [];
    lines.push("争议焦点");
    lines.push("堆放情况：" + (admitted.length
      ? admitted.join("、") + "已承认楼道里的东西挡住了通行。"
      : "尚未有一方明确承认楼道堆物影响通行，建议先到现场看一遍。"));
    lines.push("要分开的是三件事：电动车何时推出楼道，柜子和纸箱哪一天清完，以后大件还能不能放在楼道过夜。");
    lines.push("双方陈述均未提出具体赔偿金额。");
    lines.push("");
    lines.push("责任与履行");
    lines.push("1. 放置物品的一方于当天把电动车推到小区集中停放处，以后不在楼道充电。");
    lines.push("2. 柜子于本周日之前搬走，纸箱于3日内收完。这是行为义务。");
    lines.push("3. 清出后不得再堆放柜子、纸箱，不得遮挡消火栓，不得挡住正常通行。");
    lines.push("4. 靠墙临时放一双鞋可以。大件不再在楼道过夜。");
    lines.push("5. 清完当天，双方一起看楼道。仍未清出的，由村社或物业继续督促。");
    lines.push("");
    lines.push("分项处理");
    lines.push("电动车：当天移出楼道，改停集中停放处。");
    lines.push("柜子：不晚于本周日搬走。");
    lines.push("纸箱：3日内收完。");
    lines.push("以后：大件不在楼道过夜，不遮挡消火栓。");
    lines.push("");
    lines.push("金额如何确定");
    lines.push("双方均未主张具体金额。本次不报赔偿金额，也不取双方陈述的平均数。");
    lines.push("把楼道让出来是行为义务。以后如果因为堆物造成实际损失，另行提供依据再议。");
    return {
      suggestion: lines.join("\n"),
      suggestedAmount: null,
      headline: "本次不涉及赔偿金额"
    };
  }

  function applyAmountAdjustment(advice, note) {
    var text = String(note || "").trim();
    var nextAmount = parseAmount(text);
    var drop = /不报|不赔|不涉及赔偿|取消金额|无需赔偿/.test(text);
    var suggestion = String(advice && advice.suggestion || "").replace(/\n审核调整[\s\S]*$/, "");
    var suggestedAmount = advice ? advice.suggestedAmount : null;
    var headline = advice ? advice.headline : "";
    if (drop) {
      suggestedAmount = null;
      headline = "本次不涉及赔偿金额";
      suggestion = suggestion.replace(/建议修复金\s*\d+元/g, "本次不报修复金");
    } else if (nextAmount != null) {
      if (suggestedAmount != null) {
        suggestion = suggestion.replace(new RegExp(suggestedAmount + "元", "g"), nextAmount + "元");
      }
      suggestedAmount = nextAmount;
      headline = "建议修复金 " + nextAmount + "元";
    }
    var tail = ["", "审核调整", "操作人员说明：" + text];
    if (drop) tail.push("按上述说明，本次不报赔偿金额。");
    else if (nextAmount != null) tail.push("建议金额已调整为" + nextAmount + "元。该金额来自审核后的调整，不是双方主张的平均数。");
    else tail.push("说明中未写明新的金额，原建议金额维持不变。");
    return {
      suggestion: suggestion + "\n" + tail.join("\n"),
      suggestedAmount: suggestedAmount,
      headline: headline
    };
  }

  return {
    parseAmount: parseAmount,
    buildNormalized: buildNormalized,
    buildAdvice: buildAdvice,
    buildHallwayAdvice: buildHallwayAdvice,
    applyAmountAdjustment: applyAmountAdjustment
  };
});
