# Dumps Pokémon Essentials' battle animations (Data/PkmnAnimations.rxdata, a
# Ruby Marshal file) to JSON so tools/import-essentials-anims.ts can read them.
#
#   ruby tools/essentials/dump-animations.rb <PkmnAnimations.rxdata> <out.json>
#
# The classes below are empty stand-ins for Essentials' own, just enough for
# Marshal to load the data. Nothing from the game runs.
require 'json'

class PBAnimations < Array; end
class PBAnimation < Array; end
class PBAnimTiming; end
class Color; def self._load(s) = s.unpack('d4'); end
class Tone; def self._load(s) = s.unpack('d4'); end
class Table; def self._load(_s) = nil; end

ivars = ->(o) { o.instance_variables.to_h { |v| [v.to_s.delete('@'), o.instance_variable_get(v)] } }
list = Marshal.load(File.binread(ARGV[0])).instance_variable_get(:@array)
out = list.compact.filter_map do |a|
  meta = ivars.(a)
  next if meta['name'].to_s.empty?
  {
    name: meta['name'], graphic: meta['graphic'], hue: meta['hue'], position: meta['position'],
    frames: meta['array'],
    timing: (meta['timing'] || []).map { |t| ivars.(t) },
  }
end
File.write(ARGV[1], JSON.generate(out))
puts "#{out.size} animations"
