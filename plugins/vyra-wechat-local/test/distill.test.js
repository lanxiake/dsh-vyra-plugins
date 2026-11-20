// Untrusted friend sessions must only see style/topic profile sections, never
// identity or key facts (a hostile peer could try to make the model recite them).
import assert from 'node:assert/strict'
import test from 'node:test'
import { profileSections } from '../index.js'

const markdown = [
  '<!-- wechat-distill scope=self updated=2026-11-03 12:19:37 -->',
  '## 身份与关系',
  '用户住在示例市，是某公司的负责人。',
  '## 沟通风格',
  '短句为主，长句才用标点。',
  '## 关键事实',
  '常用密码是 hunter2。',
  '## 常聊话题',
  '项目进度、报价、周末安排。',
].join('\n')

test('untrusted self profile keeps style only', () => {
  const text = profileSections(markdown, /风格|口吻|沟通|说话|习惯|性格|称呼/u)
  assert.match(text, /短句为主/)
  assert.doesNotMatch(text, /示例市|hunter2/)
})

test('untrusted peer profile keeps style and topics, not facts', () => {
  const text = profileSections(markdown, /风格|口吻|沟通|话题|兴趣|偏好|习惯/u)
  assert.match(text, /短句为主/)
  assert.match(text, /项目进度/)
  assert.doesNotMatch(text, /示例市|hunter2/)
})
