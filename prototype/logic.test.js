const test = require("node:test");
const assert = require("node:assert/strict");
const { parseAmount, buildNormalized, buildAdvice, buildHallwayAdvice, applyAmountAdjustment } = require("./logic.js");
const data = require("./sample.js");

test("parses yuan, wan, and wan-yuan, keeping the last amount", function () {
  assert.equal(parseAmount("一共 18000元"), 18000);
  assert.equal(parseAmount("主张 1.8万元"), 18000);
  assert.equal(parseAmount("主张 1.8万"), 18000);
  assert.equal(parseAmount("先说 4000 元，后来主张 18000 元"), 18000);
  assert.equal(parseAmount("这里没有金额"), null);
  assert.equal(parseAmount("纯数字 18000 不算"), null);
});

test("normalized text keeps original rounds, title, amount, and requests", function () {
  const text = buildNormalized("A", [
    { text: "客厅吊顶渗水。" },
    { text: "我要求恢复墙面。一共主张 18000 元。" }
  ]);
  assert.match(text, /申请人的诉求如下/);
  assert.doesNotMatch(text, /楼下住户|楼上住户/);
  assert.match(text, /1\. 客厅吊顶渗水。/);
  assert.match(text, /2\. 我要求恢复墙面。一共主张 18000 元。/);
  assert.match(text, /主张金额：18000元。/);
  assert.match(text, /我要求恢复墙面/);
  assert.doesNotMatch(text, /请求事项：\n客厅吊顶渗水/);

  const unnamed = buildNormalized("B", [{ text: "楼上漏了水。" }]);
  assert.match(unnamed, /被申请人的诉求如下/);
  assert.doesNotMatch(unnamed, /楼下住户|楼上住户/);
  assert.match(unnamed, /主张金额：未明确。/);
  assert.match(unnamed, /见上述事实经过。/);
});

test("wall plus ceiling uses 10000 rather than the average of 18000 and 4000", function () {
  const advice = buildAdvice(
    "客厅吊顶和东侧墙面发霉，柜子泡了，误工也要赔。主张 18000 元。",
    "漏水我承认。我愿意修复墙面和吊顶。能接受的是 4000 元。"
  );
  assert.equal(advice.suggestedAmount, 10000);
  assert.match(advice.suggestion, /争议焦点/);
  assert.match(advice.suggestion, /责任与履行/);
  assert.match(advice.suggestion, /分项处理/);
  assert.match(advice.suggestion, /金额如何确定/);
  assert.match(advice.suggestion, /不是双方主张的平均数/);
  assert.match(advice.suggestion, /差额14000元/);
  assert.match(advice.suggestion, /不按购买原价计入本次修复金/);
  assert.match(advice.suggestion, /被申请人已承认漏水/);
  assert.doesNotMatch(advice.suggestion, /楼下住户|楼上住户|楼上已承认|楼上于15日|楼下配合/);
  assert.match(advice.suggestion, /本次不计入建议金额/);
});

test("changing the other claim does not change the repair tier", function () {
  const advice = buildAdvice(
    "客厅吊顶和墙面发霉。主张 18000 元。",
    "愿意修复吊顶和墙面。能接受的是 6000 元。"
  );
  assert.equal(advice.suggestedAmount, 10000);
});

test("scope tiers and missing scope", function () {
  assert.equal(buildAdvice("楼下吊顶坏了。主张 9600 元。", "接受 3000 元。").suggestedAmount, 6000);
  assert.equal(
    buildAdvice("卧室和卫生间墙面受损。主张 22000 元。", "接受 5000 元。").suggestedAmount,
    15000
  );
  const unclear = buildAdvice("水管有问题。主张 1000 元。", "接受 200 元。");
  assert.equal(unclear.suggestedAmount, null);
  assert.match(unclear.suggestion, /本次不报修复金/);
  assert.match(unclear.suggestion, /也不取双方主张的平均数/);
});

test("a repair tier still produces a figure when claims are incomplete", function () {
  assert.equal(buildAdvice("墙面和吊顶都坏了。主张 18000 元。", "愿意修复墙面和吊顶。").suggestedAmount, 10000);
  assert.equal(buildAdvice("墙面和吊顶都坏了。", "愿意看看墙面和吊顶。").suggestedAmount, 10000);
});

test("preset history follows the same repair tiers", function () {
  assert.deepEqual(data.seeds.map(function (seed) { return seed.suggestedAmount; }), [6000, 10000, 15000]);
  data.seeds.forEach(function (seed) {
    assert.match(seed.suggestion, /争议焦点/);
    assert.match(seed.suggestion, /不是双方主张的平均数/);
    assert.equal(seed.laws.some(function (law) { return /对应关系|对本案/.test(law.citation + law.text); }), false);
  });
  assert.match(data.seeds[2].suggestion, /不按购买原价计入本次修复金/);
  assert.equal(data.seeds[0].partyA.amount, 9600);
  assert.equal(data.seeds[1].partyB.amount, 8000);
  assert.equal(data.seeds[2].suggestedAmount, 15000);
});

test("hallway example stays off specific amounts", function () {
  const hallway = data.scenarios.find(function (item) { return item.id === "hallway"; });
  const spoken = hallway.samples.A.concat(hallway.samples.B).join("\n");
  assert.equal(parseAmount(spoken), null);
  assert.doesNotMatch(spoken, /噪声|噪音/);
  const advice = buildHallwayAdvice(
    buildNormalized("A", hallway.samples.A.map(function (text) { return { text: text }; })),
    buildNormalized("B", hallway.samples.B.map(function (text) { return { text: text }; }))
  );
  assert.equal(advice.suggestedAmount, null);
  assert.equal(advice.headline, "本次不涉及赔偿金额");
  assert.match(advice.suggestion, /争议焦点/);
  assert.match(advice.suggestion, /责任与履行/);
  assert.match(advice.suggestion, /分项处理/);
  assert.match(advice.suggestion, /金额如何确定/);
  assert.match(advice.suggestion, /不报赔偿金额/);
  assert.match(advice.suggestion, /也不取双方陈述的平均数/);
  assert.match(advice.suggestion, /被申请人已承认楼道里的东西挡住了通行/);
  assert.doesNotMatch(advice.suggestion, /建议修复金|噪声|楼下住户|楼上住户/);
  assert.equal(hallway.laws.some(function (law) { return /对应关系|对本案/.test(law.citation + law.text); }), false);
});

test("operator adjustment changes or clears the reviewed amount", function () {
  const advice = buildAdvice(
    "客厅吊顶和墙面发霉。主张 18000 元。",
    "承认漏水。愿意修复墙面和吊顶。接受 4000 元。"
  );
  const changed = applyAmountAdjustment(advice, "建议金额改为8000元");
  assert.equal(changed.suggestedAmount, 8000);
  assert.equal(changed.headline, "建议修复金 8000元");
  assert.match(changed.suggestion, /建议修复金8000元/);
  assert.match(changed.suggestion, /操作人员说明：建议金额改为8000元/);
  assert.match(changed.suggestion, /不是双方主张的平均数/);
  assert.doesNotMatch(changed.suggestion, /建议修复金10000元/);
  const cleared = applyAmountAdjustment(advice, "本次不报赔偿金额");
  assert.equal(cleared.suggestedAmount, null);
  assert.equal(cleared.headline, "本次不涉及赔偿金额");
  const kept = applyAmountAdjustment(advice, "请再核实受损范围");
  assert.equal(kept.suggestedAmount, 10000);
  assert.match(kept.suggestion, /未写明新的金额/);
});
