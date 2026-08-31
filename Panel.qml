import QtQuick
import Quickshell
import Quickshell.Io
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Local-only: the scanner reads Git plumbing under HOME and the panel renders
// its bounded JSON output. It never opens a socket or writes to a repository.
Panel {
  id: root
  moduleName: "io.github.jeremylongshore.loose-ends"
  ipcTarget: "io.github.jeremylongshore.loose-ends"
  manageIpc: false

  property var anchorItem: null
  property bool openedFromHotkey: false
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root
  readonly property string scannerPath: Qt.resolvedUrl("bin/loose-ends-scan").toString().replace(/^file:\/\//, "")
  readonly property string scanOverride: Quickshell.env("OMARCHY_LOOSE_ENDS_ROOT")
  readonly property string scanRoot: scanOverride !== "" ? scanOverride : Quickshell.env("HOME")
  readonly property int refreshSec: 300
  property var rows: []
  property bool loaded: false
  property bool scanTruncated: false
  property bool scanFailed: false
  property int repoTotal: 0
  property double nowMs: Date.now()
  readonly property bool isAlert: Model.pillSeverity(rows) === "stale" || Model.pillSeverity(rows) === "urgent"
  readonly property string label: loaded ? ((scanFailed || (scanTruncated && rows.length === 0)) ? "GIT ?" : Model.pillText(rows)) : "…"
  readonly property string tooltip: !loaded ? "Scanning local git repositories…" : (scanFailed ? "Repository scan failed; last known queue retained" : (scanTruncated ? "Partial repository scan: " + rows.length + " loose ends found" : Model.tooltipText(rows)))

  function open() { openedFromHotkey = false; root.controller.show(); root.refresh() }
  function openFromHotkey() { openedFromHotkey = true; root.controller.show(); root.refresh() }
  function close() { root.controller.hide() }
  function toggle() { if (root.opened) root.close(); else root.openFromHotkey() }
  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }
  function refresh() { nowMs = Date.now(); if (!scanProc.running) scanProc.running = true }

  Process {
    id: scanProc
    command: [root.scannerPath, "--max-depth", "4", root.scanRoot]
    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: {
        var parsed = Model.parseScan(text)
        // A malformed scan is not a clean machine. Keep the last known queue.
        var info = Model.scanInfo(text)
        if (info.valid) { root.rows = parsed; root.repoTotal = info.repoTotal; root.scanTruncated = info.truncated; root.scanFailed = false; root.loaded = true }
        else { root.scanFailed = true; root.loaded = true }
      }
    }
  }

  Timer { interval: root.refreshSec * 1000; running: true; repeat: true; triggeredOnStart: true; onTriggered: root.refresh() }
  Timer { interval: 30000; running: true; repeat: true; onTriggered: root.nowMs = Date.now() }

  IpcHandler {
    target: root.ipcTarget
    function open(): void { root.openFromHotkey() }
    function close(): void { root.close() }
    function show(): void { root.openFromHotkey() }
    function hide(): void { root.close() }
    function toggle(): void { root.toggle() }
    function refresh(): void {
      if (root.hostWidget && typeof root.hostWidget.broadcast === "function") root.hostWidget.broadcast("refresh")
      else root.refresh()
    }
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    // Keep the oldest-first queue readable after the marketplace scales the
    // full 16:9 capture down into a listing card.
    contentWidth: panel.fittedContentWidth(Style.space(640))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      Flickable {
        anchors.fill: parent
        contentWidth: width
        contentHeight: contentColumn.implicitHeight
        clip: true
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        Column {
          id: contentColumn
          width: parent.width
          spacing: Style.space(10)
          PanelHero {
            title: !root.loaded ? "SCANNING YOUR GIT WORK" : (root.scanFailed && root.rows.length === 0 ? "SCAN UNAVAILABLE" : (root.scanTruncated && root.rows.length === 0 ? "PARTIAL SCAN: NONE FOUND" : (root.rows.length === 0 ? "NO LOOSE ENDS" : root.rows.length + " REPOSITORIES NEED YOU")))
            meta: !root.loaded ? "Reading local repositories only. No network, account, or key."
              : (root.scanFailed ? (root.rows.length ? "Last scan failed. Showing the last known queue." : "Repository scan failed safely. Refresh to retry.")
                 : (root.scanTruncated ? "Discovery hit its safety cap. Showing " + root.rows.length + " loose ends found within it."
                    : (root.rows.length === 0 ? "Everything is committed, pushed, and free of old stashes." : "Oldest first. Stale work wins.")))
            foreground: root.bar ? root.bar.foreground : Color.foreground
            fontFamily: root.bar ? root.bar.fontFamily : Style.font.family
          }
          Column {
            visible: root.loaded && root.rows.length > 0
            width: parent.width
            spacing: Style.space(2)
            PanelSeparator { foreground: root.bar ? root.bar.foreground : Color.foreground }
            Repeater {
              model: root.rows
              Item {
                required property var modelData
                width: contentColumn.width
                height: Style.space(38)
                readonly property real severityHue: Model.severityHue(modelData.severity)
                readonly property color severityColor: Qt.hsla(severityHue, 0.56, 0.64, 1)
                Rectangle { anchors.fill: parent; anchors.leftMargin: Style.space(8); anchors.rightMargin: Style.space(8); radius: Style.space(4); color: Qt.hsla(parent.severityHue, 0.48, 0.50, parent.modelData.severity === "fresh" ? 0.035 : 0.10) }
                Rectangle { visible: parent.modelData.severity !== "fresh"; anchors.left: parent.left; anchors.leftMargin: Style.space(8); anchors.verticalCenter: parent.verticalCenter; width: Style.space(3); height: parent.height - Style.space(8); radius: width / 2; color: parent.severityColor }
                Column {
                  anchors.left: parent.left
                  anchors.leftMargin: Style.space(16)
                  anchors.right: parent.right
                  anchors.rightMargin: Style.space(16)
                  anchors.verticalCenter: parent.verticalCenter
                  spacing: Style.space(1)
                  Row {
                    width: parent.width
                    Text {
                      text: modelData.name
                      textFormat: Text.PlainText
                      width: parent.width * 0.62
                      elide: Text.ElideRight
                      color: modelData.severity === "fresh" ? (root.bar ? root.bar.foreground : Color.foreground) : severityColor
                      font.family: root.bar ? root.bar.fontFamily : Style.font.family
                      font.pixelSize: Style.font.body
                      font.bold: modelData.severity === "stale" || modelData.severity === "urgent"
                    }
                    Text {
                      text: modelData.ageText
                      textFormat: Text.PlainText
                      width: parent.width * 0.38
                      horizontalAlignment: Text.AlignRight
                      elide: Text.ElideRight
                      color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
                      font.family: root.bar ? root.bar.fontFamily : Style.font.family
                      font.pixelSize: Style.font.bodySmall
                    }
                  }
                  Text {
                    text: modelData.summary
                    textFormat: Text.PlainText
                    width: parent.width
                    elide: Text.ElideRight
                    color: root.bar ? Qt.darker(root.bar.foreground, 1.3) : Color.muted
                    font.family: root.bar ? root.bar.fontFamily : Style.font.family
                    font.pixelSize: Style.font.bodySmall
                  }
                }
              }
            }
          }
          Item { width: 1; height: Style.space(4) }
        }
      }
    }
  }
}
