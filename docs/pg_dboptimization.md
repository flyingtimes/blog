# PostgreSQL 数据库配置优化 

	PostgreSQL v11.2 数据库配置优化经验分享 -- 2019/10/22

![Latest Stable Version](https://img.shields.io/badge/release-v1.0.0-brightgreen) 
![Latest Stable Version](https://img.shields.io/badge/license-PostgreSQL%2011.2%20-green.svg) 

<a name="0" id="0"></a>
# **目录**

+ [配置概要](#info)
+ [资源利用配置](#resUsage)
+ [WAL配置](#WAL)
+ [流式复制配置](#rep)
+ [附加: 配置案例](#conf_detail)

<a name="info" id="info"></a>
#  概要

> 根据PostgreSQL数据库配置文件可调整项，可以将数据库配置划分为以下几大类:

- FILE LOCATIONS 文件路径
- CONNECTIONS AND AUTHENTICATION 连接与鉴权
- RESOURCE USAGE (except WAL) 资源利用
- WRITE-AHEAD LOG 
- REPLICATION 复制
- QUERY TUNING 查询配置
- REPORTING AND LOGGING 日志
- CLIENT CONNECTION DEFAULTS 客户端连接
- LOCK MANAGEMENT 锁管理
- VERSION AND PLATFORM COMPATIBILITY 版本及平台迁移
- ERROR HANDLING 报错管控
- CUSTOMIZED OPTIONS 自定义选项

本文将着重描述 RESOURCE USAGE、WAL、REPLICATION  的优化经验。

<br>
<a name="resUsage" id="resUsage"></a>
##  资源利用配置

&emsp;[返回目录](#0)

> 资源利用配置是优化中最常调整的配置类，涉及了单个查询中复杂排序内存资源分配、缓存池资源分配、vacuum清理资源分配等对性能有影响的参数配置。

**配置中文注解:**  (更详细内容[`RESOURCE USAGE官方文档`](https://www.postgresql.org/docs/11/runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS-PER-GATHER))


```
#------------------------------------------------------------------------------
# RESOURCE USAGE (except WAL)  资源利用配置
#------------------------------------------------------------------------------

# - Memory - (内存使用配置)

shared_buffers = 128MB                  # min 128kB
                                        # (change requires restart) 
										# 数据库缓存池，SQL将在内存里执行，同时写入WAL并且checkpoint后写入磁盘，修改这一配置可以减少磁盘和内存的IO频率，提升SQL性能，并且影响内存命中率会受这个值的影响

huge_pages = try                        # on, off, or try                 
                                        # 启用/禁用巨大内存页的使用。有效值是尝试（默认），开启和关闭 
                                                                 
temp_buffers = 8MB                      # min 800kB                                                      
                                        # 如果SQL执行过程中产生临时表，表的内存开销将会依赖这一值             
                                       
max_prepared_transactions = 0           # zero disables the feature  将此参数设置为零（这是默认值）会禁用准备交易功能
                                        # (change requires restart)  该参数只能在服务器启动时设置  
									    # Caution: it is not advisable to set max_prepared_transactions nonzero unless      
									    # you actively intend to use prepared transactions. 如果不打算使用准备好的事务，则应将此参数设置为零以防止意外创建准备好的事务

work_mem = 4MB                          # min 64kB
										# 指定写入临时磁盘文件之前内部排序操作和散列表使用的内存量，如果一个query中存在复杂排序会调用这一值，每一个会话是固定分配的，所以需要估计好可能的会话连接数，如果过大，会导致数据库占用内存资源过多而被KILL掉

maintenance_work_mem = 64MB             # min 1MB
										# 指定维护操作要使用的最大内存量，例如VACUUM，CREATE INDEX和ALTER TABLE ADD FOREIGN KEY，这个参数会影响index的创建调整、建表、vacuum等维护性操作的内存空间，调大可以加速相关操作

autovacuum_work_mem = -1                # min 1MB, or -1 to use maintenance_work_mem
										# 自动vacuum占用内存空间
                                        # 指定每个autovacuum工作进程要使用的最大内存量。 它默认为-1，表示应该使用maintenance_work_mem的值。在其他情况下运行时，该设置对VACUUM的行为没有影响。

max_stack_depth = 2MB                   # min 100kB               
                                        # 指定服务器执行堆栈的最大安全深度。这个参数的理想设置是由内核执行的实际堆栈大小限制（由ulimit -s或本地等效设置），少于一兆字节左右的安全余量。

dynamic_shared_memory_type = posix      # the default is the first option
                                        # supported by the operating system:
                                        #   posix
                                        #   sysv
                                        #   windows
                                        #   mmap
                                        # use none to disable dynamic shared memory
                                        # (change requires restart)
                                        # 指定服务器应该使用的动态共享内存实现。 
                                        # 可能的值是posix（用于使用shm_open分配的POSIX共享内存），
                                        # sysv（用于通过shmget分配的System V共享内存），
                                        # Windows（用于Windows共享内存），
                                        # mmap（使用存储在数据目录中的内存映射文件来模拟共享内存 ）和none（禁用此功能）。 
                                        # 并非所有平台都支持所有值; 第一个受支持的选项是该平台的默认选项。 
                                        # 通常不鼓励在任何平台上使用mmap选项，因为操作系统可能会将修改的页面反复写回到磁盘，从而增加系统I / O负载; 
                                        # 但是，对于调试，pg_dynshmem目录存储在RAM磁盘上或其他共享内存设施不可用时，它可能很有用


# - Disk - (磁盘使用配置)

#temp_file_limit = -1                   # limits per-process temp file space
                                        # in kB, or -1 for no limit
                                        # 指定会话可以用于临时文件的最大磁盘空间量，例如排序和散列临时文件，或者持有游标的存储文件。 试图超过此限制的交易将被取消。 该值以千字节为单位指定，-1（默认值）表示无限制。 只有超级用户可以更改此设置。
                                        # 此设置限制了给定PostgreSQL会话使用的所有临时文件在任何时刻使用的总空间。 应该注意的是，用于显式临时表的磁盘空间与在查询执行过程中使用的后台临时文件不同，并不计入此限制。


# - Kernel Resources - (内核资源使用配置)

#max_files_per_process = 1000           # min 25
                                        # (change requires restart)
                                        # 设置每个服务器子进程允许的最大同时打开文件数。 默认值是一千个文件。 如果内核正在执行安全的每进程限制，则不必担心此设置。 
                                        # 但是在某些平台上（特别是大多数BSD系统），如果许多进程都尝试打开那么多文件，内核将允许单个进程打开比系统实际支持的文件多得多的文件。 
                                        # 如果发现自己看到“打开的文件太多”失败，请尝试减少此设置。 该参数只能在服务器启动时设置


# - Cost-Based Vacuum Delay - (Vacuum开销配置)

#vacuum_cost_delay = 0                  # 0-100 milliseconds
                                        #这个参数可以在任何时候被设置。默认值是0。它决定执行VACUUM 和ANALYZE命令的进程的睡眠时间。单位是微秒。
                                        #它的值最好是10的整数，如果不是10的整数，系统会自动将它设为比该值大的并且最接近该值的是10的倍数的整数。
                                        #如果值是0，VACUUM 和ANALYZE命令在执行过程中不会主动进入睡眠状态，会一直执行下去直到结束。


#vacuum_cost_page_hit = 1               # 0-10000 credits
#vacuum_cost_page_miss = 10             # 0-10000 credits
#vacuum_cost_page_dirty = 20            # 0-10000 credits
#vacuum_cost_limit = 200                # 1-10000 credits


# - Background Writer - (后台写数据库进程配置)

#bgwriter_delay = 200ms                 # 10-10000ms between rounds
                                        # 决定后台写数据库进程的睡眠时间。后台写数据库进程每次完成写数据到物理文件中的任务以后，就会睡眠bgwriter_delay指定的时间。 
                             
#bgwriter_lru_maxpages = 100            # max buffers written/round, 0 disables
                                        # 这个参数只能在文件postgresql.conf中设置。默认值是100。后台写数据库进程每次写脏数据块时，写到外部文件中的脏数据块的个数不能超过bgwriter_lru_maxpages指定的值。
                                        # 例如，如果它的值是500，则后台写数据库进程每次写到物理文件的数据页的个数不能超过500，若超过，进程将进入睡眠状态，等下次醒来再执行写物理文件的任务。
                                        # 如果它的值被设为0, 后台写数据库进程将不会写任何物理文件（但还会执行检查点操作）。


#bgwriter_lru_multiplier = 2.0          # 0-10.0 multiplier on buffers scanned/round
                                        # 这个参数只能在文件postgresql.conf中设置。默认值是2.0。它决定后台写数据库进程每次写物理文件时，写到外部文件中的脏数据块的个数（不能超过bgwriter_lru_maxpages指定的值）。
                                        # 一般使用默认值即可，不需要修改这个参数。这个参数的值越大，后台写数据库进程每次写的脏数据块的个数就越多。

#bgwriter_flush_after = 512kB           # measured in pages, 0 disables

# - Asynchronous Behavior - (同步特性配置)

#effective_io_concurrency = 1           # 1-1000; 0 disables prefetching

#max_worker_processes = 8               # (change requires restart)
										# 设置系统能够支持的后台进程的最大数量

#max_parallel_maintenance_workers = 2   # taken from max_parallel_workers

#max_parallel_workers_per_gather = 2    # taken from max_parallel_workers

#parallel_leader_participation = on

#max_parallel_workers = 8               # maximum number of max_worker_processes that
                                        # can be used in parallel operations
										# 这个参数与数据库系统外并发量无关，主要是单个查询操作，如果优化器判定其可以并发执行，就会调用相关的线程进行工作，这个是最大线程数量

#old_snapshot_threshold = -1            # 1min-60d; -1 disables; 0 is immediate
                                        # (change requires restart)

#backend_flush_after = 0                # measured in pages, 0 disables


```
	
**重点配置详解:**
- **shared_buffers** - 
<br>  &emsp;`数据库缓存池大小，SQL将在内存(缓存池)里执行，与此同时写入WAL并且在执行checkpoint后写入Disk，所以修改这一配置可以减少磁盘和内存的IO频率，提升SQL性能，并且影响内存命中率。`
<br>  &emsp;(该参数只能在服务器启动时设置) `默认值通常为128 MB`，该设置必须至少为128千字节，但是，通常需要高于最小值的设置才能获得良好的性能。
<br>  &emsp;在`1GB或更多内存的专用数据库服务器`，shared buffers的`合理起始值`是系统内存的`25％`，但由于PostgreSQL也受制于操作系统缓存机制，所以shared buffers的`分配最好不要超过40％的RAM`。
<br>  &emsp;在`小于1GB内存的专用数据库服务器`，shared buffers的`较小比例是合适的`，以便为操作系统留出足够的空间。
<br>  &emsp;另外需要注意，shared buffers的较大设置通常需要max wal size的相应增加，以便分散在较长时间内编写大量新数据或更改数据的过程。在Windows系统上shared_buffers的有用范围通常为64MB到512MB。

- **work_mem** - 
<br>  &emsp; `单会话排序内存值分配，指定写入临时磁盘文件之前内部排序操作和散列表使用的内存量`，一个query中如存在复杂排序(例如，`排序操作用于ORDER BY，DISTINCT和合并连接`, `散列表用于散列连接`，`基于散列的聚合和基于散列的IN子查询处理`)会调用这一值，每一个会话是固定分配的。
<br>  &emsp; 该`值默认为4兆字节(4MB)`，需要`注意估计好可能的会话连接数，如果过大，会导致数据库占用内存资源过多，进程被系统KILL掉`。对于复杂的查询，可能会同时运行多个排序或散列操作, 此外，多个运行会话可以同时进行这些操作。 因此，`所使用的总内存可能是work_mem值的许多倍`, 选择值时必须牢记这一事实。(在15分钟性能数据入库排序汇总时出现过进程被kill情况，导致数据库服务短时间不可用)

- **maintenance_work_mem** - 
<br> &emsp; `该参数会影响index的创建调整、建表、vacuum等维护性操作的内存空间，调大可以加速相关操作指定维护操作要使用的最大内存量`，例如VACUUM，CREATE INDEX和ALTER TABLE ADD FOREIGN KEY。
<br> &emsp; `默认为64兆字节（64MB）` 由于这些操作中只有一个可以通过数据库会话一次执行，并且安装通常不会同时运行多个操作，因此将此`值设置为比work_mem大得多是安全的`。 较大的设置可能会提高抽真空和还原数据库转储的性能。
<br> &emsp;  请注意，自动清理运行时，`maintenance_work_mem*autovacuum_max_workers的大小不要超过系统内存总量`，因此请注意不要将默认值设置得太高。 另外，通过单独设置autovacuum_work_mem来控制它也是可行的。

- **autovacuum_work_mem** - 
<br> &emsp; `自动vacuum占用内存空间，指定每个autovacuum工作进程要使用的最大内存量`。 
<br> &emsp; 它`默认为-1`，表示应该使用maintenance_work_mem的值。

- **max_worker_processes** - 
<br> &emsp; `系统支持最大后台进程数量最大值, 类似一个worker资源池。`
<br> &emsp; 它`默认为 8`，并且仅能在服务启动时生效。当进行`从节点`配置时，需要设置`和主节点一样的数值`，否则query将没法执行。当进行该值调整时，需要考虑调整max_parallel_workers，max_parallel_maintenance_workers 以及 max_parallel_workers_per_gather。

- **max_parallel_workers** - 
<br> &emsp; `数据库系统支持并发线程数最大值，这个参数与数据库系统外并发量无关，主要是单个查询操作，如果优化器判定其可以并发执行，就会调用相关的线程进行工作，这个是最大线程数量`
<br> &emsp; 它`默认为 8`，当需要调高或调低该值时，需要考虑连带调整max_parallel_maintenance_workers以及max_parallel_workers_per_gather，以为资源都从max_parallel_workers中获取。如果该值设置的比max_worker_processes更高，将不会生效，因为parallel workers是从workers process池中获取的。

<br>
<a name="WAL" id="WAL"></a>
##  WAL配置

&emsp;[返回目录](#0)

> WAL配置也是日常是优化中重要配置类，比如调整fsync、checkpoints timeouts，能从更深层的实现机理上能提升一定查询的性能，并且针对性的调整WAL MAX/MIN SIZE、ARCHIVE能更好的利用机器的存储空间。

**配置中文注解:** (更详细内容[`WAL 官方文档`](https://www.postgresql.org/docs/11/runtime-config-resource.html#GUC-MAX-PARALLEL-WORKERS-PER-GATHER))


```
#------------------------------------------------------------------------------
# WRITE-AHEAD LOG
#------------------------------------------------------------------------------
# - Settings - (WAL通用配置)

#wal_level = replica                    # minimal, replica, or logical
                                        # (change requires restart)
										# WAL级别，可以调整适配逻辑复制以及物理复制场景
                                        # wal_level决定写入WAL的信息量。默认值是minimal，只写入从崩溃中恢复或立即关闭所需的信息。archive 添加了WAL归档所需的日志记录; hot_standby进一步增加了在备用服务器上运行只读查询所需的信息; 最后logical添加了支持逻辑解码所需的信息。

#fsync = on                             # flush data to disk for crash safety
                                        # (turning this off can cause
                                        # unrecoverable data corruption)
										# 如果打开这个参数，PostgreSQL服务器将尝试通过发出fsync（）系统调用或各种等效方法（请参阅wal_sync_method）来确保更新物理写入磁盘


#synchronous_commit = on                # synchronization level;
                                        # off, local, remote_write, remote_apply, or on
                                        # 指定在命令向客户端返回“成功”指示之前，事务提交是否将等待WAL记录写入磁盘。有效值为on，remote_write，local和off。默认和安全设置已打开。当关闭时，从向客户报告成功的时间到确保事务确实对服务器崩溃安全的时间之间可能存在延迟。 （最大延迟是wal_writer_delay的三倍）。与fsync不同，将此参数设置为off不会造成数据库不一致的风险：操作系统或数据库崩溃可能导致某些最近涉嫌提交的事务丢失，但数据库状态将会就好像这些交易已被彻底放弃一样。因此，关闭transaction_commit可能是一个有用的选择，当性能比事务的持久性确切的确定性更重要时。
                                       
#wal_sync_method = fsync                # the default is the first option
                                        # supported by the operating system:
                                        #   open_datasync
                                        #   fdatasync (default on Linux)
                                        #   fsync
                                        #   fsync_writethrough
                                        #   open_sync
                                        # 用于强制WAL更新到磁盘的方法。如果fsync关闭，则此设置无关紧要，因为WAL文件更新根本不会被强制排除。可能的值是： 
                                        # open_datasync（使用open（）选项写入WAL文件O_DSYNC） 
                                        # fdatasync（每次提交时调用fdatasync（）） 
                                        # fsync（在每次提交时调用fsync（）） 
                                        # fsync_writethrough（在每次提交时调用fsync（），强制直写任何磁盘写入缓存） 
                                        # open_sync（使用open（）选项写入WAL文件O_SYNC） 

#full_page_writes = on                  # recover from partial page writes
                                        # 这个参数只能在postgresql.conf文件中被设置。默认值是on。打开这个参数，可以提高数据库的可靠性，减少数据丢失的概率，但是会产生过多的事务日志，降低数据库的性能。

#wal_compression = off                  # enable compression of full-page writes WAL压缩

#wal_log_hints = off                    # also do full page writes of non-critical updates
                                        # (change requires restart)
                                        
#wal_buffers = -1                       # min 32kB, -1 sets based on shared_buffers
                                        # (change requires restart)
                                        #这个参数只有在启动数据库时，才能被设置。它指定事务日志缓冲区中包含的数据块的个数，每个数据块的大小是8KB，所以默认的事务日志缓冲区的大小是8*8=64KB。事务日志缓冲区位于数据库的共享内存中。

#wal_writer_delay = 200ms               # 1-10000 milliseconds
                                        #这个参数只能在postgresql.conf文件中被设置。它决定写事务日志进程的睡眠时间。WAL进程每次在完成写事务日志的任务后，就会睡眠wal_writer_delay指定的时间，然后醒来，继续将新产生的事务日志从缓冲区写到WAL文件中。单位是毫秒（millisecond），默认值是200

#wal_writer_flush_after = 1MB           # measured in pages, 0 disables

#commit_delay = 0                       # range 0-100000, in microseconds
                                        # 这个参数可以在任何时候被设置。它设定事务在发出提交命令以后的睡眠时间，只有在睡眠了commit_delay指定的时间以后，事务产生的事务日志才会被写到事务日志文件中，事务才能真正地提交。
                                        # 增大这个参数会增加用户的等待时间，但是可以让多个事务被同时提交，提高系统的性能。如果数据库中的负载比较高，而且大部分事务都是更新类型的事务，可以考虑增大这个参数的值。
                                        # 下面的参数commit_siblings会影响commit_delay是否生效。默认值是0，单位是微秒（microsecond）。

#commit_siblings = 5                    # range 1-1000
                                        # 这个参数可以在任何时候被设置。这个参数的值决定参数commit_delay是否生效。假设commit_siblings的值是5，如果一个事务发出一个提交请求，此时，如果数据库中正在执行的事务的个数大于或等于5，那么该事务将睡眠commit_delay指定的时间。
                                        # 如果数据库中正在执行的事务的个数小于5，这个事务将直接提交。默认值是5。


# - Checkpoints -(WAL检查点配置)

#checkpoint_timeout = 5min              # range 30s-1d
                                        # 这个参数只能在postgresql.conf文件中被设置。单位是秒，默认值是300。它影响系统何时启动一个检查点操作。
                                        # 如果现在的时间减去上次检查点操作结束的时间超过了checkpoint_timeout的值，系统就会自动启动一个检查点操作。增大这个参数会增加数据库崩溃以后恢复操作需要的时间。

max_wal_size = 32GB                     # WAL最大size，WAL整体size固定，采取循环利用方式。

min_wal_size = 2560MB                   # WAL最小size，WAL由于的空间长期不占满会被自动回收，该值时确定最小不能回收的wal size。

#checkpoint_completion_target = 0.5     # checkpoint target duration, 0.0 - 1.0
                                        # 这个参数控制检查点操作的执行时间。合法的取值在0到1之间，默认值是0.5。不要轻易地改变这个参数的值，使用默认值即可。 这个参数只能在postgresql.conf文件中被设置

#checkpoint_flush_after = 256kB         # measured in pages, 0 disables

#checkpoint_warning = 30s               # 0 disables

#checkpoint_segments = 3                #这个参数只能在postgresql.conf文件中被设置。默认值是3。它影响系统何时启动一个检查点操作。
                                        #如果上次检查点操作结束以后，系统产生的事务日志文件的个数超过checkpoint_segments的值，系统就会自动启动一个检查点操作。增大这个参数会增加数据库崩溃以后恢复操作需要的时间。


# - Archiving -(WAL归档配置) 

#archive_mode = off             # enables archiving; off, on, or always
                                # (change requires restart)
                                # 当启用archive_mode时，通过设置archive_command将完成的WAL段发送到归档存储。 除关闭外，要禁用，还有两种模式：开启和始终。 在正常操作期间，两种模式之间没有区别，但设置为始终在存档恢复或待机模式下也启用WAL存档器。 在始终模式下，从归档还原或流式复制流式传输的所有文件都将被归档（再次）。 
                                # archive_mode和archive_command是单独的变量，因此可以在不离开存档模式的情况下更改archive_command。 该参数只能在服务器启动时设置。 当wal_level设置为minimal时，无法启用archive_mode。

#archive_dir = ''               # 这个参数只有在启动数据库时，才能被设置。默认值是空串。它设定存放归档事务日志文件的目录。

#archive_command = ''           # command to use to archive a logfile segment
                                # placeholders: %p = path of file to archive
                                #               %f = file name only
                                # e.g. 'test ! -f /mnt/server/archivedir/%f && cp %p /mnt/server/archivedir/%f'
                                #执行本地shell命令以归档已完成的WAL文件段。字符串中的任何％p被替换为要归档的文件的路径名称，并且任何％f都将仅替换为文件名。 （路径名相对于服务器的工作目录，即集群的数据目录。）使用%%在命令中嵌入实际的％字符。只有成功时，该命令才能返回零退出状态，这一点很重要。
                                #该参数只能在postgresql.conf文件或服务器命令行中设置。除非在服务器启动时启用了archive_mode，否则将被忽略。如果在启用archive_mode的情况下archive_command是空字符串（缺省值），则暂时禁用WAL归档，但服务器会继续累积WAL段文件，以期即将提供命令。将archive_command设置为一个只返回true的命令，例如/ bin / true（Windows中的REM）可以有效地禁用归档，但也会打破归档恢复所需的WAL文件链，因此只能在特殊情况下使用。

#archive_timeout = 0            # force a logfile segment switch after this
                                # number of seconds; 0 disables
                                # archive_command仅为已完成的WAL段调用。因此，如果您的服务器生成很少的WAL流量（或者在这种情况下存在冗余时段），则在事务完成和归档存储器中的安全记录之间可能存在很长的延迟。
                                # 为了限制未归档的数据的存储时间，可以搜索搜索设置archive_timeout来强制服务器定期切换到新的WAL段文件。当此参数大于零时，只要从最后一个段文件切换后经过了许多秒，服务器就会切换到新的段文件，并且存在任何数据库活动（包括单个检查点）。 
                                # （增加checkpoint_timeout将减少空闲系统上不必要的检查点。）请注意，由于强制切换而提前关闭的归档文件的长度与完整文件的长度相同。
                                # 因此，使用非常短的archive_timeout是不明智的 - 它会使您的归档存储膨胀。一分钟左右的archive_timeout设置通常是合理的。
                                # 如果您希望将数据从主服务器上快速复制出来，则应考虑使用流式复制而不是归档。该参数只能在postgresql.conf文件或服务器命令行中设置。
```

**重点配置详解:**
- **wal_level** - 
<br> &emsp; `WAL级别设置，可以调整适配逻辑复制以及物理复制场景，通过wal_level决定写入WAL的信息量。`
<br> &emsp; `默认值是minimal(该参数只能在服务器启动时设置)`只写入从崩溃中恢复或立即关闭所需的信息。`archive`添加了WAL归档所需的日志记录; `hot_standby`进一步增加了在备用服务器上运行只读查询所需的信息;最后`logical`添加了支持逻辑解码所需的信息。每个级别都包含记录在所有较低级别的信息。
<br> &emsp; 1.如果设置为`minimal`级别，可以安全地跳过一些批量操作的WAL记录，这可以使这些操作更快。可以应用此优化的操作包括：CREATE TABLE AS、创建索引簇。复制到在同一事务中创建或截断的表中但minimal的WAL不包含足够的信息来重建基本备份和WAL日志中的数据，因此必须使用归档或更高级别来启用WAL归档（archive_mode）和流式复制。
<br> &emsp; 2.如果在`hot_standby`级别，将记录与归档相同的信息，以及重建WAL中正在运行的事务状态所需的信息。要在备用服务器上启用只读查询，必须在主服务器上将wal_level设置为hot_standby或更高（主从），并且必须在备用服务器中启用hot_standby。据认为，在使用hot_standby和存档级别之间，性能之间几乎没有可衡量的差异，因此，如果对生产的影响很明显，欢迎提供反馈意见。
<br> &emsp; 3.如果在`logical`级别中，记录的信息与hot_standby相同，还包括允许从WAL中提取逻辑变更集所需的信息。使用逻辑级别会增加WAL卷的数量，特别是如果为REPLICA IDENTITY FULL配置了许多表并且执行了许多UPDATE和DELETE语句。
- **fsync** - 
<br> &emsp; PostgreSQL服务器将尝试通过发出fsync()系统调用或各种等效方法(请参阅wal_sync_method)来确保更新物理写入磁盘，这可以确保操作系统或硬件崩溃后数据库集群可以恢复到一致状态。
<br> &emsp; 虽然关闭fsync通常会带来性能上的好处，但如果发生电源故障或系统崩溃，这可能会导致不可恢复的数据损坏。因此，如果您可以轻松地从外部数据重新创建整个数据库，仅建议关闭fsync。
<br> &emsp; 关闭fsync的安全环境示例包括：从备份文件初始加载新数据库集群，使用数据库集群处理一批数据，之后数据库将被丢弃并重新创建，或用于只读数据库克隆经常重新创建，不用于故障转移。高质量的硬件本身并不足以成为关闭fsync的理由。
<br> &emsp; 为了在将fsync从off更改时进行可靠恢复，必须强制内核中的所有已修改缓冲区进行持久存储。这可以通过运行initdb –sync-only，运行同步，卸载文件系统或重新启动服务器来关闭群集或fsync打开时完成。
<br> &emsp; 在很多情况下，关闭用于非关键事务的synchronous_commit可以提供关闭fsync的许多潜在性能优势，而没有数据损坏的伴随风险。
<br> &emsp; fsync只能在postgresql.conf文件或服务器命令行中设置。如果您关闭此参数，请考虑关闭full_page_writes。
- **full_page_writes** - 
- **wal_compression** - 
- **checkpoint_timeout** - 
- **wal_sync_method** - 
- **max_wal_size** - 
- **min_wal_size** - 
- **checkpoint_segments** - 
- **archive_mode** - 


<br>
<a name="rep" id="rep"></a>
##  REPLICATION 配置

&emsp;[返回目录](#0)

> REPLICATION配置是设置内建流复制的行为。服务器将可以是主控服务器或后备服务器。主控机能发送数据，而后备机总是被复制数据的接收者。当使用级联复制时，后备服务器也可以是发送者，同时也是接收者。这些参数主要用于发送服务器和后备服务器，尽管某些只在主服务器上有意义。如果有必要，设置可以在集群中变化而不出问题。

**配置中文注解:** (更详细内容[`WAL 官方文档`](https://www.postgresql.org/docs/11/runtime-config-replication.html))

```
#------------------------------------------------------------------------------
#REPLICATION 复制
#------------------------------------------------------------------------------

# - Sending Servers - (发送服务器)

max_wal_senders = 10            # max number of walsender processes
                                #指定来自后备服务器或流式基础备份客户端的并发连接的最大数量（即同时运行 WAL 发送进程 的最大数）。默认值是10，0值意味着禁用复制。
                                #这个参数只能在服务器启动时被设置。 wal_level必须设置为archive或更高级别以允许来自后备服 务器的连接。

max_replication_slots = 10         # max number of replication slots
                                   #指定服务器可以支持的复制槽 最大数量。默认值为10。这个参数只能在服务器启动时设置。

wal_keep_segments = 0       # in logfile segments; 0 disables
                            #指定在后备服务器需要为流复制获取日志段文件的情况下，pg_wal目录下所能保留的过去日志文件段的最小数目。每个段通常是 16 兆字节。
                            #如果一个连接到发送服务器的后备服务器落后了超过wal_keep_segments个段，发送服务器可以移除一个后备机仍然需要的 WAL 段，在这种情况下复制连接将被中断。最终结果是下行连接也将最终失败（不过，如果在使用 WAL 归档，后备服务器可以通过从归档获取段来恢复）。
                            #这个参数只能在postgresql.conf文件中或在服务器命令行上设置。



wal_sender_timeout = 60s          # in milliseconds; 0 disables
                                  #中断那些停止活动超过指定毫秒数的复制连接。这对发送服务器检测一个后备机崩溃或网络中断有用。零值将禁用该超时机制。这个参数只能在postgresql.conf文件中或在服务器命令行上设置。默认值是 60 秒。

track_commit_timestamp = off        # collect timestamp of transaction commit
                                    #记录事务提交时间。这个参数只能在postgresql.conf文件 或者服务器命令行上设置。缺省值是off。

# - Master Server - (主服务器)

synchronous_standby_names = ''    # standby servers that provide sync rep
                                  # method to choose sync standbys, number of sync standbys,
                                  # and comma-separated list of application_name
                                  # from standby(s); '*' = all

                                  #这个参数指定一个支持同步复制的后备服务器的列表。 可能会有一个或者多个活动的同步后备服务器， 在这些后备服务器确认收到它们的数据之后，等待提交的事务将被允许继续下去。 
                                  #同步后备服务器是那些名字出现在这个列表中， 并且当前已连接并且正在实时流传输数据（如 pg_stat_replication视图中streaming 的状态所示）的服务器。指定多个同步备用可以实现非常高的可用性并防止数据丢失。
                                  #用于此目的的备用服务器的名称是备用数据库的application_name设置， 如备用数据库的连接信息中所设置的。在物理复制备用的情况下， 这应该在recovery.conf的primary_conninfo 设置中设置；默认值是walreceiver。对于逻辑复制， 可以在订阅的连接信息中设置，并且它默认为订阅名称。对于其他复制流消费者， 请参阅他们的文档。
                                  #这个参数只能在postgresql.conf文件中或在服务器命令行上设置。

vacuum_defer_cleanup_age = 0          # number of xacts by which cleanup is delayed
                                      #指定VACUUM和HOT更新在清除死亡行版本之前，应该推迟多久（以事务数量计）。默认值是零个事务，表示死亡行版本将被尽可能快地清除，即当它们不再对任何打开的事务可见时尽快清除。
                                      #这个参数只能在postgresql.conf文件中或在服务器命令行上设置。
                                                                            

# - Standby Servers - (后备服务器) 

hot_standby = on                # "off" disallows queries during recovery
                                #指定在恢复期间，你是否能够连接并运行查询，。默认值是on。这个参数只能在服务器启动时设置。它只在归档恢复期间或后备机模式下才有效。

max_standby_archive_delay = 30s         # max delay before canceling queries
                                        # when reading WAL from archive;
                                        # -1 allows indefinite delay
                                        #当热后备机处于活动状态时，这个参数决定取消那些与即将应用的 WAL 项冲突的后备机查询之前，后备服务器应该等待多久，如第 26.5.2 节中所述。当 WAL 数据正在通过流复制被接收时，max_standby_streaming_delay可以应用。
                                        #默认值是 30 秒。如果没有指定，衡量单位是毫秒。值 -1 允许后备机一直等到冲突查询结束。这个参数只能在postgresql.conf文件中或在服务器命令行上设置。
                                                                               

wal_receiver_status_interval = 10s     # send replies at least this often
                                       # 0 disables
                                       #指定在后备机上的 WAL 接收者进程向主服务器或上游后备机发送有关复制进度的信息的最小频度，它可以使用pg_stat_replication视图看到。后备机将报告它已经写入的上一个预写式日志位置、它已经刷到磁盘的上一个位置以及它已经应用的最后一个位置。
                                       #这个参数只能在postgresql.conf文件中或在服务器命令行上设置。默认值是 10 秒。

hot_standby_feedback = off             # send info from standby to prevent
                                       # query conflicts
                                       #指定一个热后备机是否将会向主服务器或上游后备机发送有关于后备机上当前正被执行的查询的反馈。这个参数可以被用来排除由于记录清除导致的查询取消，但是可能导致在主服务器上用于某些负载的数据库膨胀。反馈消息的发送频度不会高于每个wal_receiver_status_interval周期发送一次。默认值是off。这个参数只能在postgresql.conf文件中或在服务器命令行上设置。
                                                                    

wal_receiver_timeout = 60s            # time that receiver waits for
                                      # communication from master
                                      # in milliseconds; 0 disables
                                      #中止处于非活动状态超过指定毫秒数的复制链接。这对于正在接收的后备服务器检测主服务器崩溃或网络断开有用。值零会禁用超时机制。这个参数只能在postgresql.conf文件中或在服务器命令行上设置。默认值是 60 秒。

wal_retrieve_retry_interval = 5s       # time to wait before retrying to
                                       # retrieve WAL after a failed attempt
                                       #指定等待服务器应等待多长时间时， 当重试检索WAL数据之前来自任何源 （流复制，本地pg_wal或者WAL归档）的WAL数据不可用。 此参数只能在postgresql.conf文件或服务器命令行设置。 缺省值是5秒。如果没有指定，单位是毫秒。
                                                                       

# - Subscribers -（订阅）
max_logical_replication_workers = 4    # taken from max_worker_processes
                                       #指定逻辑复制工作的最大数量。这包括应用工作和表同步工作。
                                       #逻辑复制工作进程是从max_worker_processes 定义的进程池中取出的。
                                       #默认值是4。

max_sync_workers_per_subscription = 2       # taken from max_logical_replication_workers
                                            #每个订阅的最大同步工作者数量。 此参数控制订阅初始化期间或添加新表时初始数据副本的并行数量。
                                            #目前，每个表只能有一个同步工作进程。
                                            #同步工作进程是从max_logical_replication_workers 定义的进程池中取出的。
                                            #默认值是2。

```
**重点配置详解:**
- **max_wal_senders** - 
<br>  &emsp;WAL 发送进程被计算在连接总数内，`因此该参数 不能被设置为高于max_connections的值。`突然的流客户端断开连接可能导致一个孤立连接槽（知道达到超时），因此这个参数应该设置得`略高于最大客户端连接数`，这样断开连接的客户端可以立刻重新连接。

- **max_replication_slots** - 
<br>  &emsp;要允许使用复制槽， `wal_level必须被设置为archive或 更高`。把它的值设置为低于现有复制槽的数量会阻止服务器启动。

- **wal_keep_segments** - 
<br>  &emsp;只设置pg_wal中保留的文件段的最小数目；系统可能需要为 WAL 归档或从一个检查点恢复保留更多段。`如果wal_keep_segments为零（默认值）， 更多的空间来 存放WAL归档或从一个检查点恢复。`
<br>  &emsp;如果wal_keep_segments是零（缺省）， 系统不会为后备目的保留任何多余的段，因此后备服务器可用的旧 WAL 段的数量是一个上个检查点位置和 WAL 归档状态的函数。

- **synchronous_standby_names** - 
<br>  &emsp;这个参数使用下面的语法之一来指定一个后备服务器列表：
 <br>  &emsp; `[FIRST] num_sync ( standby_name [, ...] ) ANY num_sync ( standby_name [, ...] ) standby_name [, ...]`
 <br>  &emsp; 其中num_sync 是事务需要等待其回复的同步后备服务器的数量，standby_name 是一个后备服务器的名称。 FIRST和ANY 指定从列出的服务器中选择同步备用数据库的方法。
 <br>  &emsp;关键字FIRST加上num_sync， 指定基于优先级的同步复制，并使事务提交等待， 直到它们的WAL记录被复制到根据其优先级进行选择的 num_sync同步备用数据库。 
 <br>  &emsp;例如，FIRST 3 (s1, s2, s3, s4) 的设置将导致每个提交等待来自从备用服务器 s1、s2、s3和s4 中选择出来的三个更高级备用服务器的回复。 
  <br>  &emsp;其名称出现在列表前面的备用数据库被赋予更高的优先级，并将被视为同步。 在列表后面出现的其他备用服务器代表潜在的同步备用服务器。 如果任何当前的同步备用服务器因任何原因断开连接， 它将立即被次最高优先级的备用机器替换。关键字FIRST是可选的。
 <br>  &emsp;`关键字ANY加上num_sync， 指定基于数量的同步复制，并使事务提交等待，直到它们的WAL记录被复制到 至少num_sync 个列出的备用服务器。例如，ANY 3 (s1, s2, s3, s4) 的设置将导致每个提交至少被s1、s2、 s3 和s4中的任意三个备用服务器回复处理。`
 <br>  &emsp;FIRST和ANY是大小写无关的。 如果这些关键字用作备用服务器的名称，那么 standby_name必须是双引号引用的。
 <br>  &emsp;`第三种语法在PostgreSQL版本9.6之前使用，并且仍然受支持。 它与第一个使用FIRST和num_sync 等于1的语法相同。例如，FIRST 1 (s1, s2)和s1, s2 具有相同的含义：选择s1或s2作为同步备用。`
<br>  &emsp;特殊项*匹配任何备用服务器名称。
 <br>  &emsp;没有机制来强制备用名称的唯一性。在重复的情况下， 匹配的备用数据库之一将被视为较高优先级，但确切地说哪一个是不确定的。
 <br>  &emsp;`注意：每一个standby_name 都应该具有合法 SQL 标识符的形式，除非它是*。 如果必要你可以使用双引号。但是注意在比较 standby_name 和后备机应用程序名称时是大小写不敏感的（不管有没有双引号）。`
 <br>  &emsp;如果这里没有指定同步后备机名称，那么同步复制不能被启用并且事务提交将不会等待复制。这是默认的配置。即便当同步复制被启用时，个体事务也可以被配置为不等待复制，做法是将synchronous_commit参数设置为local或off。

- **vacuum_defer_cleanup_age** - 
<br>  &emsp;在一个支持热后备服务器的主服务器上，你可能希望把这个参数设置为一个非零值，这允许后备机上的查询有更多时间来完成而不会由于先前的行清除产生冲突。
<br>  &emsp;但是，由于该值是用在主服务器上发生的写事务的数目衡量的，很难预测对后备机查询可用的附加时间到底是多少。
<br>  &emsp;你也可以考虑设置后备服务器上的hot_standby_feedback作为使用这个参数的一种替代方案。
<br>  &emsp;这无法阻止已经达到old_snapshot_threshold 所指定年龄的死亡行被清除。

- **max_standby_archive_delay** - 
<br>  &emsp; 注意，max_standby_streaming_delay与取消之前一个查询能够运行的最长时间不同；`它表示在从主服务器接收到 WAL 数据并立刻应用它能够被允许的最长总时间。`因此，如果一个查询导致了显著的延迟，后续冲突查询将只有更少的时间，直到后备服务器再次赶上进度。

- **wal_receiver_status_interval** - 
<br>  &emsp;这个参数的值是报告之间的最大间隔，以秒计。每次写入或刷出位置改变时会发送状态更新，或者至少按这个参数的指定的频度发送。因此，应用位置可能比真实位置略微滞后。将这个参数设置为零将完全禁用状态更新。

- **hot_standby_feedback** - 
<br>  &emsp;如果使用级联复制，反馈将被向上游传递直到它最后到达主服务器。后备机在接收到反馈之后除了传递给上游不会做任何其他操作。
<br>  &emsp;这个设置`不会覆盖主服务器上的old_snapshot_threshold的行为`， 后备服务器上一个超过了主服务器年龄阈值的快照可能会变得不可用， 导致后备服务器上事务的取消。这是因为old_snapshot_threshold 是为了对死亡行能够存在的时间给出一个`绝对限制`， 不然就会因为一个后备服务器的配置而被违背。

- **wal_retrieve_retry_interval** - 
<br>  &emsp; 此参数有助于配置恢复节点控制等待新的WAL数据可用的时间数。 例如，`在归档恢复中，通过减少此参数的值检测一个新的WAL日志文件中使得恢复更加敏感`， 这种做法是有可能的。在一个低WAL活动系统中，增加它减少了必要的访问WAL归档的需求量， 一些有用例子在云环境中访问基础设施的时间量要考虑在内。

