import { UIAbility, AbilityConstant, Want } from '@kit.AbilityKit'
import { window } from '@kit.ArkUI'

export default class EntryAbility extends UIAbility {
  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    console.info('[PhiMystra] EntryAbility onCreate')
  }

  onDestroy(): void {
    console.info('[PhiMystra] EntryAbility onDestroy')
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    console.info('[PhiMystra] EntryAbility onWindowStageCreate')
    windowStage.loadContent('pages/Index', (err) => {
      if (err.code) {
        console.error('[PhiMystra] Failed to load content. ' + JSON.stringify(err))
        return
      }
      console.info('[PhiMystra] Succeeded in loading content.')
    })
  }

  onWindowStageDestroy(): void {
    console.info('[PhiMystra] EntryAbility onWindowStageDestroy')
  }

  onForeground(): void {
    console.info('[PhiMystra] EntryAbility onForeground')
  }

  onBackground(): void {
    console.info('[PhiMystra] EntryAbility onBackground')
  }
}
