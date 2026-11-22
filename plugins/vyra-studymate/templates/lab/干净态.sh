#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────
# StudyMate · lab 干净态入口（摆盘 → 调 check.sh → 原样转述事实）
#
# 「干净态」= 任务留白、参考解仍在 `solutions/` 里。**判分入口只有一个，还是 `check.sh`**：
# 本脚本只做三件事，一件都不多：
#   · **摆盘**：整棵 lab 拷进一个**临时目录**，在那里跑（真 lab 一个字节都不动）；
#   · **跑**：`sh check.sh`，输出直接透传（不截、不改、不加工）；
#   · **转述**：临时目录、命令、退出码逐行印成事实，再把 check.sh 那个退出码原样交回去。
# **不判定、不设第二套退出码语义**：非零不是判决，只是「这一次的退出码是多少」这条事实。
#
# 用法：sh 干净态.sh
# 另两个脚本：`sh 作答态.sh`（把参考解的作答摆进临时副本再跑）、`sh 自检.sh`（两态各一遍）
# 变量名一律 ASCII：`sh` 认不得中文变量名（打印出来的标签仍是中文）。
# ─────────────────────────────────────────────────────────────────────────
set -u

# 卡住时的唯一出口：印一行事实（这次没跑起来、卡在哪一步），把**卡住那一步自己的**退出码
# 原样交回去（`check.sh` 里那句「谁卡住就交回谁的退出码」是同一个姿势）。非零在这里只说
# 「这一趟没跑起来」——卡在哪由那一行说清，所以没有第二套码表，也不编一个数字。
stuck() {
  printf '这次没跑起来：%s；check.sh 没跑（退出码 %s 说的就是这件事）\n' "$1" "$2"
  exit "$2"
}

SELF=$(dirname "$0")
cd "$SELF" || stuck "进不去脚本所在目录「$SELF」，卡在第一步（定位骨架）" $?
ROOT=$PWD

# 任务目录 = 骨架里除 solutions/ 之外的第一个目录（照抄后改成 `<NNNN>-<主题>` 也认得）
TASK=
for CAND in "$ROOT"/*/; do
  [ -d "$CAND" ] || continue
  NAME=$(basename "$CAND")
  [ "$NAME" = solutions ] && continue
  TASK=$NAME
  break
done
if [ -z "$TASK" ]; then
  printf '任务目录不在：%s 下没有一个 <NNNN>-<主题> 目录\n' "$ROOT"
  # 非零照实交回：就是这条判据（任务目录在不在）此刻自己的退出码，不编一个数字
  [ -n "$TASK" ]
  stuck "卡在找任务目录这一步（就是上面那句）" $?
fi

TMP=$(mktemp -d) || stuck "建不了临时目录（mktemp -d 没成），卡在摆盘" $?
cp -R "$ROOT"/. "$TMP"/ || stuck "整棵 lab 拷不进临时目录「$TMP」，卡在摆盘" $?
printf '状态：干净态（任务留白、参考解仍在 solutions/ 里）\n'
printf '临时目录：%s\n' "$TMP"
printf '命令：sh check.sh（cwd %s/%s）\n' "$TMP" "$TASK"
( cd "$TMP/$TASK" && sh check.sh )
CODE=$?
printf '干净态退出码：%d\n' "$CODE"
rm -rf "$TMP"
printf '临时目录已删：%s\n' "$TMP"
exit "$CODE"
