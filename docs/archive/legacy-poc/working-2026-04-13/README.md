# Working Codebase Backup — DO NOT DELETE
# 
# Backup created: 2026-04-13
# Status: 100% working ChatGPT/chat.com streaming to side panel
# 
# This directory contains the last known working version of the
# ChatGPT mirror extension before any destructive changes.
#
# Key features that ARE WORKING:
# - ChatGPT AI message streaming to side panel (delta encoding v1)
# - Side panel receives and displays AI messages in real-time
# - User prompt injection via textarea + send button
# - Per-tab conversation storage
# - Live streaming UI updates
#
# Core files:
# - inject-web.js: SSE delta parser, ChatGPTPlugin intercepts responses
# - content.js: Bridge between MAIN world and background script
# - background.js: Message router, conversation store, streaming state
# - sidepanel.js: UI with live streaming, textarea injection
# - manifest.json: Extension configuration
