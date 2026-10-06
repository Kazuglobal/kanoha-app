-- 1日の学習時間の上限を 60 分にそろえる(設定画面の最大値も 60 分)。
UPDATE `app_settings` SET `daily_limit_minutes` = 60;
