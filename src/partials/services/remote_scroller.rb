#!/usr/bin/env ruby
require 'daemons'

Daemons.run_proc("remote_scroller") do
  Dir.chdir("/src/ruby/remotescroller/") do
    exec("ruby /src/ruby/remotescroller/remote_scroller_daemon.rb --log /data/logs")
  end
end
