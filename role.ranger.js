module.exports = {

    /** @param {Creep} creep **/
    run: function(creep) {
        var enemy = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
        if(enemy){
            if(ERR_NOT_IN_RANGE === creep.rangedAttack(enemy))
                creep.moveTo(enemy)
        }
        else if(!creep.memory.flag){
            var flagNames = ['ranger', 'ranger2']
            var flagWatchers = []

            for(let i = 0; i < flagNames.length; i++){
                flagWatchers[i] = {name: flagNames[i], count: 0}
            }

            // Game.creeps is game provided hash, so we don't want to iterate it
            // too many times, hence outer loop.
            for(let cname in Game.creeps){
                c = Game.creeps[cname]
                for(let i = 0; i < flagNames.length; i++){
                    let flag = Game.flags[flagNames[i]]
                    if(!flag)
                        continue
                    if(c.memory.flag === flagNames[i])
                        flagWatchers[i].count++
                }
            }

            flagWatchers.sort((a,b) => a.count - b.count)
            var flag = Game.flags[flagWatchers[0].name]
            if(flag)
                creep.memory.flag = flag.name
        }
        else{
            var flag = Game.flags[creep.memory.flag]
            if(flag && !flag.pos.isNearTo(creep.pos))
                creep.moveTo(flag)
            else if(!creep.memory.ready){
                creep.say('ready')
                creep.memory.ready = true
            }
        }
	}
};
